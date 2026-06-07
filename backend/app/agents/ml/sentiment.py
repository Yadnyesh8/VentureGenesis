"""Customer Sentiment Agent (Phase 4).

FinBERT (ProsusAI/finbert) via transformers when available; otherwise a lexicon-based
fallback. Outputs aggregate sentiment + per-review breakdown.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("venturegenesis.ml.sentiment")

_pipe = None
_TRIED = False

POS_WORDS = {
    "love", "great", "excellent", "amazing", "good", "fast", "helpful", "recommend",
    "happy", "best", "intuitive", "reliable", "awesome", "fantastic", "smooth", "easy",
}
NEG_WORDS = {
    "bad", "terrible", "slow", "buggy", "hate", "worst", "broken", "expensive",
    "confusing", "crash", "poor", "disappointed", "useless", "frustrating", "awful", "lacking",
}


def _load_pipe():
    global _pipe, _TRIED
    if _TRIED:
        return _pipe
    _TRIED = True
    try:
        from transformers import pipeline  # type: ignore

        _pipe = pipeline("sentiment-analysis", model="ProsusAI/finbert")
    except Exception as exc:  # pragma: no cover
        logger.info("FinBERT unavailable (%s); lexicon fallback", exc)
        _pipe = None
    return _pipe


def _lexicon(review: str) -> str:
    tokens = set(review.lower().replace(".", " ").replace(",", " ").split())
    pos = len(tokens & POS_WORDS)
    neg = len(tokens & NEG_WORDS)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def analyze_sentiment(reviews: list[str] | None) -> dict[str, Any]:
    reviews = [r for r in (reviews or []) if r and r.strip()]
    if not reviews:
        # No reviews provided — don't fabricate sentiment.
        return {
            "sentiment": "no_data",
            "sentiment_score": None,
            "distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "breakdown": [],
            "method": "no_input",
        }
    pipe = _load_pipe()
    breakdown = []
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    method = "finbert" if pipe else "lexicon"
    for r in reviews:
        if pipe:
            try:
                label = pipe(r[:512])[0]["label"].lower()
                if label not in counts:
                    label = "neutral"
            except Exception:
                label = _lexicon(r)
        else:
            label = _lexicon(r)
        counts[label] += 1
        breakdown.append({"review": r, "sentiment": label})

    overall = max(counts, key=counts.get)
    total = max(sum(counts.values()), 1)
    score = (counts["positive"] - counts["negative"]) / total
    return {
        "sentiment": overall,
        "sentiment_score": round(score, 3),
        "distribution": counts,
        "breakdown": breakdown,
        "method": method,
    }
