"""Agent analysis endpoints (Phases 4, 5, 7, 8)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.health import compute_health
from app.agents.ml.risk_detection import detect_risks
from app.agents.intelligence import agents as intel
from app.agents.intelligence import agi as agi_intel
from app.agents.intelligence import spinout as spinout_intel
from app.agents.intelligence import causal as causal_intel
from app.agents.ml import voi as voi_ml
from app.agents.ml import causal as causal_ml
from app.agents.startup_understanding import understand
from app.agents import idea_validation
from app.core import llm
from app.agents.board import board_decision
from app.simulation import digital_twin
from app.simulation.pivot import run_pivot_pipeline
from app.db import models
from app.db.database import get_db
from app.db.schemas import (
    AGIRequest, CausalRequest, SimulateRequest, SpinoutRequest, StartupRef, VOIRequest,
)
from app.utils.resolve import resolve_metrics


def _causal_leverage(metrics: dict) -> dict:
    """Per-field leverage from the causal death path, to bias VOI toward fatal unknowns."""
    try:
        traj = causal_ml.map_trajectory(metrics)
    except Exception:
        return {}
    lev: dict[str, float] = {}
    for node in traj.get("chain", []):
        if "node" in node:
            lev[node["node"]] = max(lev.get(node["node"], 0.0), node.get("activation", 0.0))
        elif "from" in node:
            lev[node["from"]] = max(lev.get(node["from"], 0.0), node.get("leverage", 0.0))
    return lev

router = APIRouter()


def _persist_prediction(db, startup_id, **kw):
    if startup_id is None:
        return
    try:
        db.add(models.Prediction(startup_id=startup_id, **kw))
        db.commit()
    except Exception:
        db.rollback()


@router.post("/understand")
def api_understand(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": understand(m)}


@router.post("/failure")
def api_failure(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = predict_failure(m)
    _persist_prediction(db, ref.startup_id, failure_probability=result["failure_12m"])
    return {"ok": True, "data": result}


@router.post("/forecast")
def api_forecast(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = forecast_revenue(m, ref.revenue_series)
    if ref.startup_id is not None:
        try:
            db.add(models.Forecast(startup_id=ref.startup_id,
                                   forecast_3m=result["forecast_3m"],
                                   forecast_6m=result["forecast_6m"],
                                   forecast_12m=result["forecast_12m"]))
            db.commit()
        except Exception:
            db.rollback()
    return {"ok": True, "data": result}


@router.post("/funding")
def api_funding(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = predict_funding(m)
    _persist_prediction(db, ref.startup_id, funding_probability=result["funding_probability"])
    return {"ok": True, "data": result}


@router.post("/risk")
def api_risk(ref: StartupRef, db: Session = Depends(get_db)):
    """Deterministic multi-category risk register, enriched with trained-model signals."""
    m = resolve_metrics(ref, db)
    failure_prob = funding_prob = None
    try:
        failure_prob = predict_failure(m)["failure_12m"]
        funding_prob = predict_funding(m)["funding_probability"]
    except Exception:
        pass  # risk register still works from raw metrics alone
    return {"ok": True, "data": detect_risks(m, failure_prob, funding_prob)}


@router.post("/health")
def api_health(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    funding = predict_funding(m)
    result = compute_health(m, funding["funding_probability"])
    _persist_prediction(db, ref.startup_id, health_score=result["health_score"])
    return {"ok": True, "data": result}


# Note: metrics already carry industry/business_model/stage from the questionnaire, so we
# pass them straight to the agent — no extra understand() LLM round-trip (halves latency).
@router.post("/competitor")
def api_competitor(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.competitor(m)}


@router.post("/market")
def api_market(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.market_opportunity(m)}


@router.post("/strategy")
def api_strategy(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.founder_strategy(m)}


@router.post("/simulate")
def api_simulate(req: SimulateRequest, db: Session = Depends(get_db)):
    """Scenario what-if engine: apply the scenario to the digital twin, then RE-RUN the
    trained failure model + health/funding on the simulated company to show predicted impact."""
    m = resolve_metrics(req, db)
    state = digital_twin.build_state(m)
    after = digital_twin.apply_scenario(state, req.scenario)

    sim_m = digital_twin.apply_scenario_to_metrics(m, req.scenario)

    def predicted(metrics):
        funding = predict_funding(metrics)
        failure = predict_failure(metrics)
        health = compute_health(metrics, funding["funding_probability"])
        return {
            "failure_12m": failure["failure_12m"],
            "health_score": health["health_score"],
            "funding_probability": funding["funding_probability"],
        }

    base_pred = predicted(m)
    sim_pred = predicted(sim_m)
    impact = {
        k: {
            "before": base_pred[k],
            "after": sim_pred[k],
            "change": round(sim_pred[k] - base_pred[k], 3),
        }
        for k in base_pred
    }

    return {
        "ok": True,
        "data": {
            "scenario": req.scenario,
            "before": state,
            "after": after,
            "diff": digital_twin.diff(state, after),
            "predicted_impact": impact,
        },
    }


@router.post("/pivots")
def api_pivots(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = run_pivot_pipeline(m)
    if ref.startup_id is not None:
        try:
            for p in result.get("all_pivots", [])[:5]:
                db.add(models.PivotResult(
                    startup_id=ref.startup_id, pivot_name=p["pivot_name"],
                    success_probability=p["success_probability"],
                    roi=p["roi"], risk_score=p["risk_score"]))
            db.commit()
        except Exception:
            db.rollback()
    return {"ok": True, "data": result}


@router.post("/board")
def api_board(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = board_decision(m, ref.revenue_series)
    return {"ok": True, "data": result}


# ---- Frontier agents (Features 1-4) ----

@router.post("/voi")
def api_voi(ref: VOIRequest, db: Session = Depends(get_db)):
    """Value-of-Information ledger: rank decision-critical unknowns by VOI vs cost."""
    m = resolve_metrics(ref, db)
    result = voi_ml.assess(m, allow_fetch=ref.allow_fetch, causal_leverage=_causal_leverage(m))
    if ref.startup_id is not None:
        try:
            for item in result.get("ledger", [])[:10]:
                db.add(models.VOIDecision(
                    startup_id=ref.startup_id, field=item["field"], voi=item["voi"],
                    cost=item["cost_usd"], decided_fetch=int(item["fetched"]),
                    source=item["source"]))
            db.commit()
        except Exception:
            db.rollback()
    return {"ok": True, "data": result}


@router.post("/agi")
def api_agi(ref: AGIRequest, db: Session = Depends(get_db)):
    """AGI Pre-Conditioner: AGI-resistance score + milestone breakage + redesigns."""
    m = resolve_metrics(ref, db)
    result = agi_intel.precondition(m, ref.moats)
    if ref.startup_id is not None:
        try:
            db.add(models.AGIAssessment(
                startup_id=ref.startup_id, resistance_score=result.get("resistance_score"),
                years_of_defensibility=result.get("years_of_defensibility")))
            db.commit()
        except Exception:
            db.rollback()
    return {"ok": True, "data": result}


@router.post("/spinout")
def api_spinout(req: SpinoutRequest, db: Session = Depends(get_db)):
    """Corporate Spin-out Viability: EV(spin-out) vs EV(internal) + recommendation."""
    project = req.project.model_dump()
    metrics = req.metrics.model_dump() if req.metrics is not None else None
    result = spinout_intel.evaluate(project, metrics)
    try:
        db.add(models.SpinoutAssessment(
            project_name=project.get("project_name"), recommendation=result.get("recommendation"),
            ev_spinout=result.get("ev_spinout"), ev_internal=result.get("ev_internal")))
        db.commit()
    except Exception:
        db.rollback()
    return {"ok": True, "data": result}


@router.post("/causal")
def api_causal(ref: CausalRequest, db: Session = Depends(get_db)):
    """Causal Trajectory Mapping: current-KPI → death cascade + intervention points."""
    import json as _json

    m = resolve_metrics(ref, db)
    result = causal_intel.narrate(m)
    if ref.startup_id is not None:
        try:
            db.add(models.CausalTrajectory(
                startup_id=ref.startup_id, death_probability=result.get("death_probability"),
                months_to_death=result.get("months_to_death"),
                path=_json.dumps(result.get("chain", []))))
            db.commit()
        except Exception:
            db.rollback()
    return {"ok": True, "data": result}


@router.post("/idea")
def api_idea(ref: StartupRef, db: Session = Depends(get_db)):
    """Idea validation loop: comparable products, differentiation, viability.

    Unlike the other agents this reads ref.description rather than the metrics —
    it is judging the idea, not the numbers. Without a description there is
    nothing to assess, and 422 says so rather than returning an empty verdict
    the founder might mistake for a real one.
    """
    m = resolve_metrics(ref, db)
    try:
        result = idea_validation.validate(ref.description or "", m)
    except idea_validation.NoIdeaError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except llm.LLMError as exc:
        # The loop is the most call-hungry agent here, so it is the one that
        # meets the free tier's rate limit first. Say that plainly instead of
        # returning a 500 that reads like the feature is broken.
        raise HTTPException(
            status_code=503,
            detail=f"The model provider is unavailable or rate-limited right now — try again shortly. ({exc})",
        )
    return {"ok": True, "data": result}
