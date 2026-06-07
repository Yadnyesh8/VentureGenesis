"""Debate engine endpoints (Phase 6) — streaming + blocking."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agents.debate_engine import run_debate, run_debate_blocking, sse_format
from app.agents.startup_understanding import understand
from app.db import models
from app.db.database import get_db, SessionLocal
from app.db.schemas import StartupRef
from app.utils.resolve import resolve_metrics

router = APIRouter()


def _save_transcript(startup_id, transcript):
    if startup_id is None:
        return
    db = SessionLocal()
    try:
        for m in transcript:
            db.add(models.Debate(
                startup_id=startup_id, agent_name=m["role"], round=m["round"],
                message=m["message"], stance=m.get("stance")))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.post("/debate/stream")
async def debate_stream(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    ctx = {**m, **understand(m)}
    startup_id = ref.startup_id

    async def gen():
        transcript = []
        for event in run_debate(ctx):
            if event["type"] == "message":
                transcript.append({k: event[k] for k in ("round", "role", "message", "stance") if k in event})
            yield sse_format(event)
            await asyncio.sleep(0.35)  # pacing so the UI animates
        _save_transcript(startup_id, transcript)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/debate")
def debate_blocking(ref: StartupRef, db: Session = Depends(get_db)):
    m = resolve_metrics(ref, db)
    ctx = {**m, **understand(m)}
    result = run_debate_blocking(ctx)
    _save_transcript(ref.startup_id, result["transcript"])
    return {"ok": True, "data": result}
