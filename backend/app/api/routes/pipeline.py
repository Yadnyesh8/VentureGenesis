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

from app.agents.ml.failure_prediction import predict_failure
from app.agents.ml.revenue_forecast import forecast_revenue
from app.agents.ml.funding_readiness import predict_funding
from app.agents.ml.health import compute_health
from app.agents.intelligence import agents as intel
from app.agents.intelligence import agi as agi_intel
from app.agents.debate_engine import run_debate
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
#
# Startup Understanding is deliberately absent: it is run on demand from the
# dashboard (POST /understand) rather than on every board run. It classified
# industry/business model/stage, all of which the founder already supplied in
# onboarding, so paying an LLM call for it on each run bought little.
STEPS = [
    ("failure", "Failure Prediction", "ml"),
    ("forecast", "Revenue Forecast", "ml"),
    ("funding", "Funding Readiness", "ml"),
    ("health", "Startup Health", "ml"),
    ("root_cause", "Root Cause Analysis", "llm"),
    ("founder_strategy", "Founder Strategy", "llm"),
    ("investor", "Investor (VC)", "llm"),
    ("financial_risk", "Financial Risk (CFO)", "llm"),
    ("competitor", "Competitor Intelligence", "llm"),
    ("market", "Market Opportunity", "llm"),
    ("agi", "AGI Pre-Conditioner", "llm"),
    ("debate", "Boardroom Debate", "llm"),
    ("board", "Board Verdict", "llm"),
]


@router.post("/board/stream")
def board_stream(ref: StartupRef, db: Session = Depends(get_db)):
    metrics = resolve_metrics(ref, db)
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

        # The founder's own answers are the context now. Previously this also carried
        # the Startup Understanding classification; that agent moved to an on-demand
        # dashboard action, so the six agents below reason from the questionnaire.
        ctx = {**metrics}

        yield from step("failure", "Failure Prediction", "ml", lambda: predict_failure(metrics))
        yield from step("forecast", "Revenue Forecast", "ml", lambda: forecast_revenue(metrics, series))
        yield from step("funding", "Funding Readiness", "ml", lambda: predict_funding(metrics))
        fp = out.get("funding", {}).get("funding_probability") if isinstance(out.get("funding"), dict) else None
        yield from step("health", "Startup Health", "ml", lambda: compute_health(metrics, fp))

        fi = out.get("failure", {}).get("feature_importance", []) if isinstance(out.get("failure"), dict) else []
        yield from step("root_cause", "Root Cause Analysis", "llm", lambda: intel.root_cause(fi, metrics))
        yield from step("founder_strategy", "Founder Strategy", "llm", lambda: intel.founder_strategy(ctx))
        yield from step("investor", "Investor (VC)", "llm", lambda: intel.investor(ctx))
        yield from step("financial_risk", "Financial Risk (CFO)", "llm", lambda: intel.financial_risk(ctx))
        yield from step("competitor", "Competitor Intelligence", "llm", lambda: intel.competitor(ctx))
        yield from step("market", "Market Opportunity", "llm", lambda: intel.market_opportunity(ctx))
        yield from step("agi", "AGI Pre-Conditioner", "llm", lambda: agi_intel.precondition(metrics))

        # Debate — stream each message (and the Round 0 VOI uncertainty audit) as produced.
        yield _sse({"type": "agent_start", "key": "debate", "label": "Boardroom Debate", "kind": "llm"})
        transcript = []
        consensus = "neutral"
        metrics_consensus = None
        metrics_tally = None
        audit: list[dict] = []
        t0 = time.time()
        try:
            for ev in run_debate(ctx):
                if ev["type"] == "message":
                    # `lens` carries each agent's specialist quantitative inputs (dilution math
                    # for the Investor, burn-multiple for the CFO, …) and `computed_stance` is
                    # the code-derived verdict the LLM had to argue — so the UI can show that
                    # agents reason over different numbers AND own a real decision function,
                    # not just different prompts.
                    keep = ("round", "role", "message", "stance", "lens", "computed_stance", "computed_why")
                    transcript.append({k: ev[k] for k in keep if k in ev})
                    yield _sse({"type": "debate_message", **{k: ev[k] for k in keep if k in ev}})
                elif ev["type"] in ("info_request", "info_fetched", "info_skipped_low_voi", "info_unavailable"):
                    audit.append(ev)
                    yield _sse(ev)
                elif ev["type"] == "consensus":
                    consensus = ev["consensus"]
                    metrics_consensus = ev.get("metrics_consensus")
                    metrics_tally = ev.get("metrics_tally")
            out["debate"] = {"consensus": consensus, "metrics_consensus": metrics_consensus,
                             "metrics_tally": metrics_tally, "transcript": transcript,
                             "uncertainty_audit": audit}
            yield _sse({"type": "agent_done", "key": "debate", "label": "Boardroom Debate",
                        "ms": int((time.time() - t0) * 1000), "result": {"consensus": consensus, "messages": len(transcript)}})
        except Exception as exc:
            out["debate"] = {"error": str(exc)}
            yield _sse({"type": "agent_error", "key": "debate", "label": "Boardroom Debate", "error": str(exc)})

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
