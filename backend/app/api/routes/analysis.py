"""Agent analysis endpoints (Phases 4, 5, 7, 8)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.churn import predict_churn
from app.agents.ml.sentiment import analyze_sentiment
from app.agents.ml.health import compute_health
from app.agents.intelligence import agents as intel
from app.agents.startup_understanding import understand
from app.agents.board import board_decision
from app.simulation import digital_twin
from app.simulation.pivot import run_pivot_pipeline
from app.db import models
from app.db.database import get_db
from app.db.schemas import SimulateRequest, StartupRef
from app.utils.resolve import resolve_metrics

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


@router.post("/customer")
def api_customer(ref: StartupRef, db: Session = Depends(get_db)):
    """Churn risk + sentiment analysis combined."""
    m = resolve_metrics(ref, db)
    churn = predict_churn(m)
    sentiment = analyze_sentiment(ref.customer_reviews)
    return {"ok": True, "data": {"churn": churn, "sentiment": sentiment}}


@router.post("/health")
def api_health(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    funding = predict_funding(m)
    churn = predict_churn(m)
    result = compute_health(m, funding["funding_probability"], churn["churn_risk"])
    _persist_prediction(db, ref.startup_id, health_score=result["health_score"])
    return {"ok": True, "data": result}


@router.post("/competitor")
def api_competitor(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.competitor({**m, **understand(m)})}


@router.post("/market")
def api_market(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.market_opportunity({**m, **understand(m)})}


@router.post("/strategy")
def api_strategy(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    return {"ok": True, "data": intel.founder_strategy({**m, **understand(m)})}


@router.post("/simulate")
def api_simulate(req: SimulateRequest, db: Session = Depends(get_db)):
    m = resolve_metrics(req, db)
    state = digital_twin.build_state(m)
    after = digital_twin.apply_scenario(state, req.scenario)
    return {
        "ok": True,
        "data": {
            "scenario": req.scenario,
            "before": state,
            "after": after,
            "diff": digital_twin.diff(state, after),
        },
    }


@router.post("/pivots")
def api_pivots(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    result = run_pivot_pipeline({**m, **understand(m)})
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
    result = board_decision(m, ref.customer_reviews, ref.revenue_series)
    return {"ok": True, "data": result}
