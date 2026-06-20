"""AGI exposure scoring (Feature 2, deterministic layer).

Scores how much of a business's value/moat evaporates as AGI capability arrives, across
config-driven threat vectors, and projects a survival curve over AGI milestones. Pure,
transparent, config-weighted math (`config.json -> agi_preconditioner`) — no model
dependency, so this layer always runs. The LLM narrative lives in
`app/agents/intelligence/agi.py` and surfaces errors (no fallback), per convention.
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _infer_moats(metrics: dict[str, Any], overrides: dict[str, float] | None) -> dict[str, float]:
    """Infer 0-1 moat strengths from founder metrics; explicit overrides win."""
    cfg = get_config()["agi_preconditioner"]
    industry = metrics.get("industry") or "default"
    labor_exp = cfg["industry_labor_exposure"].get(industry, cfg["industry_labor_exposure"]["default"])

    customers = metrics.get("customer_count", 0) or 0
    funding = metrics.get("funding_amount", 0) or 0
    valuation = metrics.get("valuation", 0) or 0

    # Heuristic moat strengths (higher = more defensible against AGI).
    data_moat = _clamp(customers / 50000.0)          # proprietary data scales with users
    distribution = _clamp(customers / 100000.0 + (0.2 if metrics.get("business_model") in ("Marketplace", "B2B2C") else 0))
    regulated = {"Healthcare", "Health", "Fintech", "Finances", "Government"}
    regulatory = 0.6 if industry in regulated else 0.2
    human_trust = 0.6 if industry in {"Healthcare", "Health", "Finances", "Fintech", "Education"} else 0.25
    capital_moat = _clamp((funding + valuation) / 1.0e8)

    moats = {
        "labor_arbitrage": 1 - labor_exp,  # how little the business is just labor arbitrage
        "data_moat": data_moat,
        "distribution": distribution,
        "regulatory": regulatory,
        "human_trust": human_trust,
        "capital_moat": capital_moat,
    }
    if overrides:
        for k, v in overrides.items():
            if k in moats:
                moats[k] = _clamp(float(v))
    return moats


def assess(metrics: dict[str, Any], moats: dict[str, float] | None = None) -> dict[str, Any]:
    """AGI-resistance score, per-vector exposure breakdown, and a milestone survival curve."""
    cfg = get_config()["agi_preconditioner"]
    weights = cfg["vector_weights"]
    strengths = _infer_moats(metrics, moats)

    # exposure = 1 - moat strength, per vector
    exposure = {k: round(1 - strengths[k], 3) for k in weights}
    overall_exposure = sum(weights[k] * exposure[k] for k in weights)
    resistance = max(cfg["resistance_floor"], round(1 - overall_exposure, 3))

    # Milestone survival curve: surviving value fraction at each AGI milestone.
    curve = []
    years_defensible = None
    for m in cfg["milestones"]:
        surviving = round(_clamp(resistance * (1 - m["intensity"] * overall_exposure)), 3)
        curve.append({
            "milestone": m["name"],
            "year_offset": m["year_offset"],
            "intensity": m["intensity"],
            "surviving_value": surviving,
        })
        if years_defensible is None and surviving < 0.5:
            years_defensible = m["year_offset"]
    if years_defensible is None:
        years_defensible = cfg["milestones"][-1]["year_offset"]

    vectors = sorted(
        ({"vector": k, "exposure": exposure[k], "weight": weights[k],
          "contribution": round(weights[k] * exposure[k], 3)} for k in weights),
        key=lambda x: x["contribution"], reverse=True,
    )

    return {
        "resistance_score": resistance,
        "overall_exposure": round(overall_exposure, 3),
        "years_of_defensibility": years_defensible,
        "vectors": vectors,
        "top_threat_vector": vectors[0]["vector"] if vectors else None,
        "survival_curve": curve,
    }
