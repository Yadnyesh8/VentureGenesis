"""Board of Directors Agent (Phase 8).

Aggregates ALL agent outputs into a single executive decision + full report.
Orchestrates the full analysis pipeline, then has the Chairperson (live LLM) synthesize a
board_decision and report. No mock/heuristic substitute.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents.startup_understanding import understand
from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.health import compute_health
from app.agents.ml.risk_detection import detect_risks
from app.agents.intelligence import agents as intel
from app.agents.intelligence import agi as agi_intel
from app.agents.intelligence import causal as causal_intel
from app.agents.debate_engine import run_debate_blocking
from app.simulation.pivot import run_pivot_pipeline


def gather_all(metrics: dict[str, Any],
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

    funding_prob = out.get("funding", {}).get("funding_probability")
    safe("health", lambda: compute_health(metrics, funding_prob))
    safe("risk", lambda: detect_risks(metrics, out.get("failure", {}).get("failure_12m"), funding_prob))

    ctx = {**metrics, **out.get("understanding", {})}
    safe("root_cause", lambda: intel.root_cause(out.get("failure", {}).get("feature_importance", []), metrics))
    safe("founder_strategy", lambda: intel.founder_strategy(ctx))
    safe("investor", lambda: intel.investor(ctx))
    safe("financial_risk", lambda: intel.financial_risk(ctx))
    safe("competitor", lambda: intel.competitor(ctx))
    safe("market", lambda: intel.market_opportunity(ctx))
    safe("agi", lambda: agi_intel.precondition(metrics))
    safe("causal", lambda: causal_intel.narrate(metrics))
    safe("debate", lambda: run_debate_blocking(ctx))
    safe("pivots", lambda: run_pivot_pipeline(ctx))
    return out


def _compact(aggregate: dict[str, Any]) -> dict[str, Any]:
    """Trim the aggregate to the signal the Chair needs (keeps the prompt small)."""
    a = aggregate
    return {
        "understanding": a.get("understanding"),
        "health_score": a.get("health", {}).get("health_score"),
        "failure_12m": a.get("failure", {}).get("failure_12m"),
        "funding_probability": a.get("funding", {}).get("funding_probability"),
        "risk_level": a.get("risk", {}).get("risk_level"),
        "top_risks": [f.get("message") for f in a.get("risk", {}).get("top_risks", [])][:4],
        "forecast_12m": a.get("forecast", {}).get("forecast_12m"),
        "root_causes": [c.get("cause") for c in a.get("root_cause", {}).get("causes", [])][:4],
        "founder_actions": [r.get("action") for r in a.get("founder_strategy", {}).get("recommendations", [])][:4],
        "investor": {k: a.get("investor", {}).get(k) for k in ("would_invest", "confidence", "thesis")},
        "financial_risk": {k: a.get("financial_risk", {}).get(k) for k in ("runway_months", "risk_level", "recommendation")},
        "competitor_threat": a.get("competitor", {}).get("threat_score"),
        "market_opportunity": a.get("market", {}).get("opportunity_score"),
        "debate_consensus": a.get("debate", {}).get("consensus"),
        "recommended_pivot": a.get("pivots", {}).get("recommended_pivot"),
        "agi_resistance": a.get("agi", {}).get("resistance_score"),
        "agi_years_defensible": a.get("agi", {}).get("years_of_defensibility"),
        "death_path": {
            "root_cause": a.get("causal", {}).get("root_cause"),
            "probability": a.get("causal", {}).get("death_probability"),
            "months_to_death": a.get("causal", {}).get("months_to_death"),
        },
    }


def board_decision(metrics: dict[str, Any],
                   revenue_series: list[float] | None = None) -> dict[str, Any]:
    aggregate = gather_all(metrics, revenue_series)
    decision = llm.complete(render_prompt("board_decision", aggregate=_compact(aggregate)))
    return {"board_decision_obj": decision, "full_report": aggregate}
