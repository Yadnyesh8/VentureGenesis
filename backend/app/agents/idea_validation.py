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

from app.core import knowledge, llm
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


def _queries(idea: str, analysis: dict[str, Any], metrics: dict[str, Any]) -> list[str]:
    """What to search for.

    The agent's own first pass supplies the terms: once it has named a category
    and a core claim, those are far better search terms than the raw idea text.
    Deriving them from the analysis rather than asking the model for queries
    keeps the search free in LLM calls, which matters on a rate-limited tier.
    """
    category = str(analysis.get("category") or "").strip()
    claim = str(analysis.get("core_claim") or "").strip()
    industry = str(metrics.get("industry") or "").strip()
    seed = claim or idea[:140]

    out = [f"{seed} existing products alternatives"]
    if category:
        out.append(f"{category} competitors {industry}".strip())
    return [q for q in dict.fromkeys(q.strip() for q in out) if q][:_max_queries()]


def _max_queries() -> int:
    try:
        n = int(_settings().get("max_search_queries", 2))
    except (TypeError, ValueError):
        n = 2
    return max(0, min(n, 4))


def _search(queries: list[str]) -> dict[str, Any]:
    """Run the searches and return both the findings and an honest provenance
    record. A missing key is reported, never papered over."""
    record: dict[str, Any] = {
        "searched": bool(queries),
        "available": False,
        "queries": queries,
        "results": [],
        "reason": "",
        "spend_usd": 0.0,
    }
    if not queries:
        record["reason"] = "search disabled (max_search_queries = 0)"
        return record

    for q in queries:
        res = knowledge.fetch("web_search", q)
        if res.get("available"):
            record["available"] = True
            record["results"].append({"query": q, "value": res.get("value")})
        elif not record["reason"]:
            record["reason"] = str(res.get("reason") or "web search unavailable")

    record["spend_usd"] = round(float(knowledge.ledger().get("usd_spent", 0.0)), 4)
    return record


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

    knowledge.reset_run()

    analysis: dict[str, Any] = {}
    gaps: list[str] = []
    trace: list[dict[str, Any]] = []
    stopped = "round limit reached"
    evidence: dict[str, Any] = {"searched": False, "available": False, "queries": [],
                                "results": [], "reason": "not searched yet", "spend_usd": 0.0}

    for round_no in range(1, limit + 1):
        # Search once, after the first pass has named a category and a claim to
        # search *for*. Every later round is then grounded in the same evidence.
        if round_no == 2 and not evidence["searched"]:
            evidence = _search(_queries(idea, analysis, metrics))
            if evidence["available"] and not gaps:
                gaps = ["Reconcile your comparables against the web evidence supplied."]

        try:
            analysis = llm.complete(
                render_prompt(
                    "idea_analysis",
                    idea=idea,
                    metrics=context,
                    evidence=json.dumps(evidence)[:4000] if evidence["searched"] else "No web search was run for this pass.",
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
        # Provenance travels with the result. A founder should be able to tell a
        # verdict grounded in live search from one drawn purely from recall.
        "evidence": {
            "searched": evidence["searched"],
            "available": evidence["available"],
            "queries": evidence["queries"],
            "results_count": len(evidence["results"]),
            "reason": evidence["reason"],
            "spend_usd": evidence["spend_usd"],
        },
        "loop": {
            "rounds_run": len(trace),
            "max_rounds": limit,
            "stopped_because": stopped,
            "trace": trace,
        },
    }
