"""Pivot Generation + Optimization (Phase 7) — LLM-driven, no simulated values.

- Generation: the LLM proposes >= 3 pivots AND estimates each pivot's
  revenue_impact / risk_reduction / customer_growth / funding_probability.
- Optimization: rule-based weighted scoring (weights from config.json) ranks them and
  derives success_probability / risk_score / roi from the LLM's estimates.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import get_config, render_prompt


def _f(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def generate_pivots(context: dict[str, Any]) -> list[dict[str, Any]]:
    result = llm.complete(render_prompt("pivot_generation", context=context))
    pivots = result.get("pivots") or []
    if not pivots:
        raise ValueError("Pivot agent returned no pivots")
    return pivots


def optimize(pivots: list[dict[str, Any]]) -> dict[str, Any]:
    w = get_config()["pivot_scoring"]
    scored = []
    for p in pivots:
        rev = _f(p.get("revenue_impact"))
        risk_red = _f(p.get("risk_reduction"))
        cust = _f(p.get("customer_growth"))
        fund = _f(p.get("funding_probability"))
        score = (
            rev * w["revenue_impact_weight"]
            + risk_red * w["risk_reduction_weight"]
            + cust * w["customer_growth_weight"]
            + fund * w["funding_probability_weight"]
        )
        scored.append({
            **p,
            "revenue_impact": round(rev, 3),
            "risk_reduction": round(risk_red, 3),
            "customer_growth": round(cust, 3),
            "funding_probability": round(fund, 3),
            "score": round(score, 4),
            "success_probability": round(min(0.97, 0.4 + score), 3),
            "risk_score": round(max(0.03, 1 - risk_red) * 100, 1),
            "roi": round(rev * 100 - max(0.03, 1 - risk_red) * 30, 1),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    best = scored[0]
    return {
        "recommended_pivot": best.get("pivot_name"),
        "success_probability": best.get("success_probability"),
        "risk_score": best.get("risk_score"),
        "roi": best.get("roi"),
        "all_pivots": scored,
    }


def run_pivot_pipeline(context: dict[str, Any]) -> dict[str, Any]:
    return optimize(generate_pivots(context))
