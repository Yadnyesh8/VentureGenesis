"""Pivot Generation + Simulation + Optimization (Phase 7).

- Generation: LLM (or template) produces >= 3 pivot options from the current model.
- Simulation: each pivot gets revenue_impact, risk_reduction, customer_growth, funding_probability.
- Optimization: rule-based weighted scoring (weights from config.json) selects the best.
"""
from __future__ import annotations

import hashlib
from typing import Any

from app.core import llm
from app.core.config import get_config, render_prompt


def _seed(text: str) -> float:
    h = int(hashlib.md5(text.encode()).hexdigest(), 16)
    return (h % 1000) / 1000.0


def generate_pivots(context: dict[str, Any]) -> list[dict[str, Any]]:
    prompt = render_prompt("pivot_generation", context=context)

    def fallback():
        industry = context.get("industry", "SaaS")
        bm = context.get("business_model", "B2C")
        templates = [
            {"pivot_name": f"{bm}→B2B {industry} SaaS", "description": f"Repackage core tech as a B2B {industry} platform.",
             "rationale": "Higher ACV and stickier revenue than consumer."},
            {"pivot_name": f"AI Copilot for {industry}", "description": f"Embed an AI assistant into the {industry} workflow.",
             "rationale": "Rides AI tailwind; expands willingness to pay."},
            {"pivot_name": f"{industry} Marketplace", "description": "Become the transaction layer connecting supply and demand.",
             "rationale": "Network effects create a defensible moat."},
            {"pivot_name": f"Usage-based {industry} API", "description": "Expose capabilities as a developer-first API.",
             "rationale": "Bottom-up adoption and viral distribution."},
        ]
        return {"pivots": templates}

    result = llm.complete(prompt, mock_fn=fallback)
    pivots = result.get("pivots") or fallback()["pivots"]
    return pivots[: max(3, len(pivots))]


def simulate_pivot(pivot: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    name = pivot.get("pivot_name", "Pivot")
    s = _seed(name + str(context.get("industry", "")))
    base_growth = context.get("customer_growth", 0.05) or 0.05
    revenue_impact = round(0.1 + s * 0.6, 3)            # +10%..+70%
    risk_reduction = round(0.05 + ((s * 7) % 1) * 0.5, 3)
    customer_growth = round(base_growth + 0.05 + s * 0.25, 3)
    funding_probability = round(0.3 + ((s * 13) % 1) * 0.6, 3)
    return {
        **pivot,
        "revenue_impact": revenue_impact,
        "risk_reduction": risk_reduction,
        "customer_growth": customer_growth,
        "funding_probability": funding_probability,
    }


def optimize(simulated: list[dict[str, Any]]) -> dict[str, Any]:
    w = get_config()["pivot_scoring"]
    scored = []
    for p in simulated:
        score = (
            p["revenue_impact"] * w["revenue_impact_weight"]
            + p["risk_reduction"] * w["risk_reduction_weight"]
            + p["customer_growth"] * w["customer_growth_weight"]
            + p["funding_probability"] * w["funding_probability_weight"]
        )
        success_probability = round(min(0.97, 0.4 + score), 3)
        risk_score = round(max(0.03, 1 - p["risk_reduction"]) * 100, 1)
        roi = round(p["revenue_impact"] * 100 - risk_score * 0.3, 1)
        scored.append({
            **p,
            "score": round(score, 4),
            "success_probability": success_probability,
            "risk_score": risk_score,
            "roi": roi,
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    best = scored[0] if scored else {}
    return {
        "recommended_pivot": best.get("pivot_name"),
        "success_probability": best.get("success_probability"),
        "risk_score": best.get("risk_score"),
        "roi": best.get("roi"),
        "all_pivots": scored,
    }


def run_pivot_pipeline(context: dict[str, Any]) -> dict[str, Any]:
    pivots = generate_pivots(context)
    simulated = [simulate_pivot(p, context) for p in pivots]
    return optimize(simulated)
