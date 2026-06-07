"""Streaming board pipeline (SSE).

Runs every agent sequentially and streams progress events so the UI can animate each
agent working in real time. Because the reasoning agents make live LLM calls, this
genuinely takes time — every event corresponds to real work completing.
"""
from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agents.startup_understanding import understand
from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.churn import predict_churn
from app.agents.ml.sentiment import analyze_sentiment
from app.agents.ml.health import compute_health
from app.agents.intelligence import agents as intel
from app.agents.debate_engine import run_debate
from app.simulation.pivot import run_pivot_pipeline
from app.agents.board import _compact
from app.core import llm
from app.core.config import render_prompt
from app.db.database import get_db
from app.db.schemas import StartupRef
from app.utils.resolve import resolve_metrics

router = APIRouter()


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


# Agent registry: key, human label, kind (ml = local model/stat, llm = live reasoning)
STEPS = [
    ("understanding", "Startup Understanding", "llm"),
    ("failure", "Failure Prediction", "ml"),
    ("forecast", "Revenue Forecast", "ml"),
    ("funding", "Funding Readiness", "ml"),
    ("churn", "Customer Churn", "ml"),
    ("sentiment", "Customer Sentiment", "ml"),
    ("health", "Startup Health", "ml"),
    ("root_cause", "Root Cause Analysis", "llm"),
    ("founder_strategy", "Founder Strategy", "llm"),
    ("investor", "Investor (VC)", "llm"),
    ("financial_risk", "Financial Risk (CFO)", "llm"),
    ("competitor", "Competitor Intelligence", "llm"),
    ("market", "Market Opportunity", "llm"),
    ("debate", "Boardroom Debate", "llm"),
    ("pivots", "Pivot Engine", "llm"),
    ("board", "Board Verdict", "llm"),
]


@router.post("/board/stream")
def board_stream(ref: StartupRef, db: Session = Depends(get_db)):
    metrics = resolve_metrics(ref, db)
    reviews = ref.customer_reviews
    series = ref.revenue_series

    def gen():
        out: dict = {}
        total = len(STEPS)
        yield _sse({"type": "start", "total": total, "steps": [
            {"key": k, "label": l, "kind": kind} for k, l, kind in STEPS
        ], "llm_mode": llm.mode()})

        def step(key, label, kind, fn):
            t0 = time.time()
            yield _sse({"type": "agent_start", "key": key, "label": label, "kind": kind})
            try:
                result = fn()
                out[key] = result
                yield _sse({"type": "agent_done", "key": key, "label": label,
                            "ms": int((time.time() - t0) * 1000), "result": result})
            except Exception as exc:
                out[key] = {"error": str(exc)}
                yield _sse({"type": "agent_error", "key": key, "label": label,
                            "ms": int((time.time() - t0) * 1000), "error": str(exc)})

        yield from step("understanding", "Startup Understanding", "llm", lambda: understand(metrics))
        ctx = {**metrics, **(out.get("understanding") if isinstance(out.get("understanding"), dict) else {})}

        yield from step("failure", "Failure Prediction", "ml", lambda: predict_failure(metrics))
        yield from step("forecast", "Revenue Forecast", "ml", lambda: forecast_revenue(metrics, series))
        yield from step("funding", "Funding Readiness", "ml", lambda: predict_funding(metrics))
        yield from step("churn", "Customer Churn", "ml", lambda: predict_churn(metrics))
        yield from step("sentiment", "Customer Sentiment", "ml", lambda: analyze_sentiment(reviews))
        fp = out.get("funding", {}).get("funding_probability") if isinstance(out.get("funding"), dict) else None
        cr = out.get("churn", {}).get("churn_risk") if isinstance(out.get("churn"), dict) else None
        yield from step("health", "Startup Health", "ml", lambda: compute_health(metrics, fp, cr))

        fi = out.get("failure", {}).get("feature_importance", []) if isinstance(out.get("failure"), dict) else []
        yield from step("root_cause", "Root Cause Analysis", "llm", lambda: intel.root_cause(fi, metrics))
        yield from step("founder_strategy", "Founder Strategy", "llm", lambda: intel.founder_strategy(ctx))
        yield from step("investor", "Investor (VC)", "llm", lambda: intel.investor(ctx))
        yield from step("financial_risk", "Financial Risk (CFO)", "llm", lambda: intel.financial_risk(ctx))
        yield from step("competitor", "Competitor Intelligence", "llm", lambda: intel.competitor(ctx))
        yield from step("market", "Market Opportunity", "llm", lambda: intel.market_opportunity(ctx))

        # Debate — stream each message as it is produced.
        yield _sse({"type": "agent_start", "key": "debate", "label": "Boardroom Debate", "kind": "llm"})
        transcript = []
        consensus = "neutral"
        t0 = time.time()
        try:
            for ev in run_debate(ctx):
                if ev["type"] == "message":
                    transcript.append({k: ev[k] for k in ("round", "role", "message", "stance") if k in ev})
                    yield _sse({"type": "debate_message", **{k: ev[k] for k in ("round", "role", "message", "stance") if k in ev}})
                elif ev["type"] == "consensus":
                    consensus = ev["consensus"]
            out["debate"] = {"consensus": consensus, "transcript": transcript}
            yield _sse({"type": "agent_done", "key": "debate", "label": "Boardroom Debate",
                        "ms": int((time.time() - t0) * 1000), "result": {"consensus": consensus, "messages": len(transcript)}})
        except Exception as exc:
            out["debate"] = {"error": str(exc)}
            yield _sse({"type": "agent_error", "key": "debate", "label": "Boardroom Debate", "error": str(exc)})

        yield from step("pivots", "Pivot Engine", "llm", lambda: run_pivot_pipeline(ctx))

        # Final board synthesis
        yield _sse({"type": "agent_start", "key": "board", "label": "Board Verdict", "kind": "llm"})
        t0 = time.time()
        try:
            decision = llm.complete(render_prompt("board_decision", aggregate=_compact(out)))
            out["board"] = decision
            yield _sse({"type": "agent_done", "key": "board", "label": "Board Verdict",
                        "ms": int((time.time() - t0) * 1000), "result": decision})
        except Exception as exc:
            yield _sse({"type": "agent_error", "key": "board", "label": "Board Verdict", "error": str(exc)})

        yield _sse({"type": "complete", "report": out, "decision": out.get("board")})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
