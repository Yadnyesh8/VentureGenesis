"""Startup Understanding Agent (Phase 3) — real LLM, no mock fallback.

Classifies industry, business model, stage, and growth profile via a live model.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt


def understand(metrics: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("startup_understanding", data=metrics))
