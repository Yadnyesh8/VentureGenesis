"""Agent Intelligence Layer (Phase 5).

Six reasoning agents, each LLM-backed with a deterministic fallback:
  - Root Cause Analysis (consumes SHAP values)
  - Founder Strategy
  - Investor (VC Partner)
  - Financial Risk (CFO)
  - Competitor Intelligence
  - Market Opportunity
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt


# ---------------------------------------------------------------- Root Cause
def root_cause(shap_importance: list[dict], metrics: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("root_cause", shap=shap_importance, metrics=metrics)

    def fallback():
        causes = []
        for item in (shap_importance or [])[:5]:
            feat = item.get("feature", "unknown")
            impact_val = abs(item.get("impact", 0))
            impact = "high" if impact_val > 0.2 else "medium" if impact_val > 0.05 else "low"
            human = {
                "runway": "Limited cash runway threatens solvency",
                "churn_rate": "Elevated customer churn erodes recurring revenue",
                "customer_growth": "Weak customer growth limits expansion",
                "burn_rate": "High burn rate relative to revenue",
                "revenue": "Revenue base is small for the stage",
                "expenses": "Operating expenses outpace income",
            }.get(feat, f"{feat} is a significant risk driver")
            causes.append({"cause": human, "impact": impact, "evidence": f"{feat}={metrics.get(feat, 'n/a')}"})
        if not causes:
            causes = [{"cause": "Insufficient data for root-cause analysis", "impact": "low", "evidence": "n/a"}]
        return {"causes": causes}

    return llm.complete(prompt, mock_fn=fallback)


# ---------------------------------------------------------------- Founder Strategy
def founder_strategy(context: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("founder_strategy", context=context)

    def fallback():
        growth = context.get("customer_growth", 0) or 0
        runway = context.get("runway", 0) or 0
        recs = [
            {"area": "product", "action": "Ship the top-3 most requested features to reduce churn", "priority": "high"},
            {"area": "growth", "action": "Double down on the highest-converting acquisition channel", "priority": "high"},
            {"area": "feature", "action": "Instrument analytics to measure activation and retention", "priority": "medium"},
        ]
        if runway < 6:
            recs.insert(0, {"area": "growth", "action": "Extend runway: cut non-critical spend and open a bridge round", "priority": "high"})
        if growth > 0.15:
            recs.append({"area": "growth", "action": "Hire to scale a working go-to-market motion", "priority": "medium"})
        return {"recommendations": recs}

    return llm.complete(prompt, mock_fn=fallback)


# ---------------------------------------------------------------- Investor
def investor(context: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("investor", context=context)

    def fallback():
        growth = context.get("customer_growth", 0) or 0
        runway = context.get("runway", 0) or 0
        revenue = context.get("revenue", 0) or 0
        confidence = max(0.05, min(0.95, 0.3 + growth * 2 + min(revenue / 5_000_000, 1) * 0.3 + min(runway / 18, 1) * 0.2))
        would = confidence > 0.55
        return {
            "would_invest": would,
            "confidence": round(confidence, 2),
            "thesis": "Strong growth and capital efficiency justify a position" if would
                      else "Needs clearer traction and runway before we commit",
            "concerns": [c for c in [
                "Runway under 6 months" if runway < 6 else None,
                "Sub-par growth rate" if growth < 0.05 else None,
                "Thin revenue base" if revenue < 500000 else None,
            ] if c] or ["Standard market and execution risk"],
        }

    return llm.complete(prompt, mock_fn=fallback)


# ---------------------------------------------------------------- Financial Risk
def financial_risk(context: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("financial_risk", context=context)

    def fallback():
        burn = context.get("burn_rate", 0) or 0
        funding = context.get("funding_amount", 0) or 0
        runway = context.get("runway", 0) or (funding / burn if burn else 0)
        level = "critical" if runway < 4 else "high" if runway < 8 else "medium" if runway < 14 else "low"
        rec = {
            "critical": "Immediate cost reduction and emergency bridge financing required",
            "high": "Reduce burn by 20-30% and begin fundraising now",
            "medium": "Monitor burn closely; raise within 6 months",
            "low": "Healthy runway; invest in growth deliberately",
        }[level]
        return {"runway_months": round(runway, 1), "risk_level": level, "recommendation": rec}

    return llm.complete(prompt, mock_fn=fallback)


# ---------------------------------------------------------------- Competitor
def competitor(context: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("competitor", context=context)

    def fallback():
        industry = context.get("industry", "SaaS")
        growth = context.get("customer_growth", 0) or 0
        threat = max(20, min(90, 60 - growth * 100 + 10))
        return {
            "threat_score": round(threat, 1),
            "competitive_gap": [
                f"Incumbents in {industry} have larger distribution",
                "Pricing pressure from well-funded rivals",
                "Feature parity gap on enterprise capabilities",
            ],
            "summary": f"Moderate-to-high competitive intensity in {industry}; differentiate on speed and focus.",
        }

    return llm.complete(prompt, mock_fn=fallback)


# ---------------------------------------------------------------- Market Opportunity
def market_opportunity(context: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("market", context=context)

    def fallback():
        industry = context.get("industry", "SaaS")
        growth = context.get("customer_growth", 0) or 0
        opp = max(30, min(95, 55 + growth * 120))
        return {
            "opportunity_score": round(opp, 1),
            "recommended_market": f"Mid-market {industry} buyers with urgent budget",
            "trends": [
                "AI-driven automation expanding TAM",
                "Buyers consolidating tooling spend",
                "Shift toward usage-based pricing",
            ],
        }

    return llm.complete(prompt, mock_fn=fallback)
