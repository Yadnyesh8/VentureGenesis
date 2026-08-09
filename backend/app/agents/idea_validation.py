"""Idea Validation Agent — an analyse/review loop over the founder's stated idea.

Every other agent in the system reasons about the company's NUMBERS. This one
reasons about the idea itself: what already exists like it, what is genuinely
differentiated, which assumptions carry the thing, and whether it is worth
building at all.

It is a loop rather than a chain. Each pass produces an analysis, a second call
reviews that analysis, and the loop only continues while the reviewer names gaps
worth another pass. That means an obviously-strong or obviously-thin idea costs
one round, and a muddy one earns more scrutiny, instead of every idea paying a
fixed toll.
"""
from __future__ import annotations

import json
from typing import Any

from app.core import llm
from app.core.config import get_config, render_prompt

# Guards against a pasted business plan blowing out the prompt (and the free-tier
# token budget). The loop wants a summary, not a document.
MAX_IDEA_CHARS = 2000
# Two rounds is up to five sequential model calls. Three was up to seven, which
# reliably exhausted the free tier's rate limit mid-loop.
DEFAULT_MAX_ROUNDS = 2


class NoIdeaError(ValueError):
    """Raised when there is no idea text to assess."""


def _settings() -> dict[str, Any]:
    return get_config().get("idea_validation", {}) or {}


def _max_rounds() -> int:
    try:
        rounds = int(_settings().get("max_rounds", DEFAULT_MAX_ROUNDS))
    except (TypeError, ValueError):
        rounds = DEFAULT_MAX_ROUNDS
    return max(1, min(rounds, 5))


def _context(metrics: dict[str, Any]) -> str:
    """Only the fields that colour how an idea should be judged — an idea at
    idea-stage is held to a different bar than one with revenue behind it."""
    keep = ("startup_name", "industry", "business_model", "stage",
            "founding_year", "revenue", "customer_count", "employee_count")
    return json.dumps({k: metrics.get(k) for k in keep if metrics.get(k) not in (None, "")})


def validate(idea: str, metrics: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run the loop and return the verdict plus the analysis and the trace.

    The trace is part of the payload on purpose: a founder should be able to see
    that the reviewer pushed back twice before the verdict was issued, rather
    than being handed a confident-looking score with no provenance.
    """
    idea = (idea or "").strip()
    if not idea:
        raise NoIdeaError("No idea description was provided.")
    idea = idea[:MAX_IDEA_CHARS]

    metrics = metrics or {}
    context = _context(metrics)
    limit = _max_rounds()

    analysis: dict[str, Any] = {}
    gaps: list[str] = []
    trace: list[dict[str, Any]] = []
    stopped = "round limit reached"

    for round_no in range(1, limit + 1):
        try:
            analysis = llm.complete(
                render_prompt(
                    "idea_analysis",
                    idea=idea,
                    metrics=context,
                    prior=json.dumps(analysis) if analysis else "",
                    gaps=json.dumps(gaps) if gaps else "",
                )
            )
        except llm.LLMError:
            # A refinement pass failing is survivable — the previous pass is
            # still a real analysis. Only the first one leaves nothing to show.
            if not analysis:
                raise
            stopped = "provider unavailable during refinement"
            break

        try:
            review = llm.complete(
                render_prompt("idea_review", analysis=json.dumps(analysis))
            )
        except llm.LLMError:
            # The analysis for this round did land, so record it rather than
            # reporting zero rounds alongside a full result.
            trace.append({
                "round": round_no,
                "sufficient": False,
                "gaps": [],
                "reason": "Review could not be completed; this pass was not checked.",
            })
            stopped = "reviewer unavailable"
            break
        sufficient = bool(review.get("sufficient"))
        raw_gaps = review.get("gaps") or []
        gaps = [str(g) for g in raw_gaps if str(g).strip()] if isinstance(raw_gaps, list) else []

        trace.append({
            "round": round_no,
            "sufficient": sufficient,
            "gaps": gaps,
            "reason": str(review.get("reason") or "").strip(),
        })

        if sufficient:
            stopped = "reviewer satisfied"
            break
        if not gaps:
            # Insufficient but nothing actionable named — another identical pass
            # would burn a call to produce the same answer.
            stopped = "reviewer named no actionable gaps"
            break

    verdict = llm.complete(
        render_prompt("idea_verdict", analysis=json.dumps(analysis), metrics=context)
    )

    return {
        **verdict,
        "analysis": analysis,
        "loop": {
            "rounds_run": len(trace),
            "max_rounds": limit,
            "stopped_because": stopped,
            "trace": trace,
        },
    }
