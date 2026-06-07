"""System/config endpoints (Phase 10) — expose & live-edit config."""
from __future__ import annotations

import json

from fastapi import APIRouter, Body

from app.core import llm
from app.core.config import CONFIG_PATH, get_config, is_mock_mode

router = APIRouter()


@router.get("/config")
def read_config():
    return {"config": get_config(), "mock_mode": is_mock_mode(), "llm_mode": llm.mode()}


@router.put("/config")
def update_config(patch: dict = Body(...)):
    """Shallow-merge a patch into config.json. Hot reload makes it take effect immediately."""
    current = get_config()
    current.update(patch)
    with open(CONFIG_PATH, "w") as f:
        json.dump(current, f, indent=2)
    return {"ok": True, "config": current}


@router.get("/status")
def status():
    return {"service": "VENTUREGENESIS", "ok": True, "mock_mode": is_mock_mode(), "llm_mode": llm.mode()}
