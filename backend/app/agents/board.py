"""Board of Directors Agent (Phase 8).

Aggregates ALL agent outputs into a single executive decision + full report.
Orchestrates the full analysis pipeline, then has the Chairperson (LLM or rule-based)
synthesize a board_decision and report.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents.startup_understanding import understand
from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.churn import predict_churn
from app.agents.ml.sentiment import analyze_sentiment
from app.agents.ml.health import compute_health
from app.agents.intelligence import agents as intel
from app.agents.debate_engine import run_debate_blocking
from app.simulation.pivot import run_pivot_pipeline


def gather_all(metrics: dict[str, Any], reviews: list[str] | None = None,
               revenue_series: list[float] | None = None) -> dict[str, Any]:
    """Run every agent and collect outputs. Each wrapped so one failure can't break the board."""
    out: dict[str, Any] = {}

    def safe(name, fn):
        try:
            out[name] = fn()
        except Exception as exc:  # graceful degradation (Phase constraint)
            out[name] = {"error": str(exc), "degraded": True}

    safe("understanding", lambda: understand(metrics))
    safe("failure", lambda: predict_failure(metrics))
    safe("forecast", lambda: forecast_revenue(metrics, revenue_series))
    safe("funding", lambda: predict_funding(metrics))
    safe("churn", lambda: predict_churn(metrics))
    safe("sentiment", lambda: analyze_sentiment(reviews))

    funding_prob = out.get("funding", {}).get("funding_probability")
    churn_risk = out.get("churn", {}).get("churn_risk")
    safe("health", lambda: compute_health(metrics, funding_prob, churn_risk))

    ctx = {**metrics, **out.get("understanding", {})}
    safe("root_cause", lambda: intel.root_cause(out.get("failure", {}).get("feature_importance", []), metrics))
    safe("founder_strategy", lambda: intel.founder_strategy(ctx))
    safe("investor", lambda: intel.investor(ctx))
    safe("financial_risk", lambda: intel.financial_risk(ctx))
    safe("competitor", lambda: intel.competitor(ctx))
    safe("market", lambda: intel.market_opportunity(ctx))
    safe("debate", lambda: run_debate_blocking(ctx))
    safe("pivots", lambda: run_pivot_pipeline(ctx))
    return out


def _rule_based_decision(aggregate: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    health = aggregate.get("health", {}).get("health_score", 50)
    failure = aggregate.get("failure", {}).get("failure_12m", 0.5)
    funding = aggregate.get("funding", {}).get("funding_probability", 0.5)
    consensus = aggregate.get("debate", {}).get("consensus", "neutral")

    if health >= 70 and failure < 0.35:
        decision = "INVEST"
    elif failure > 0.7 or health < 30:
        decision = "WIND_DOWN" if failure > 0.85 else "PIVOT"
    elif consensus == "bearish" or health < 50:
        decision = "PIVOT"
    else:
        decision = "HOLD"

    confidence = round(min(0.95, 0.4 + (health / 200) + (funding * 0.2) + (0.2 if decision in ("INVEST", "WIND_DOWN") else 0)), 2)
    fin = aggregate.get("financial_risk", {})
    pivots = aggregate.get("pivots", {})

    return {
        "board_decision": decision,
        "confidence": confidence,
        "strategic_actions": [
            r["action"] for r in aggregate.get("founder_strategy", {}).get("recommendations", [])
        ][:4] or ["Focus on core retention and unit economics"],
        "growth_roadmap": aggregate.get("market", {}).get("trends", [])[:3] or ["Expand into adjacent segments"],
        "risk_mitigation": [
            c["cause"] for c in aggregate.get("root_cause", {}).get("causes", [])
        ][:3] or ["Extend runway and reduce burn"],
        "funding_strategy": fin.get("recommendation", "Raise within 6 months at a defensible valuation"),
        "summary": (
            f"Board decision: {decision} (confidence {confidence}). Health {health}, "
            f"12m failure risk {failure}. Debate consensus: {consensus}. "
            f"Top pivot if needed: {pivots.get('recommended_pivot', 'n/a')}."
        ),
    }


def board_decision(metrics: dict[str, Any], reviews: list[str] | None = None,
                   revenue_series: list[float] | None = None) -> dict[str, Any]:
    aggregate = gather_all(metrics, reviews, revenue_series)
    prompt = render_prompt("board_decision", aggregate=aggregate)
    decision = llm.complete(prompt, mock_fn=lambda: _rule_based_decision(aggregate, metrics))
    return {"board_decision_obj": decision, "full_report": aggregate}
