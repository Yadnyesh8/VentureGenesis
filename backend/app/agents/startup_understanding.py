"""Startup Understanding Agent (Phase 3).

Classifies industry, business model, stage, and growth profile.
Uses LLM when available, otherwise a deterministic heuristic over metrics.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import get_config, render_prompt


def _heuristic(metrics: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config()
    industry = metrics.get("industry") or "SaaS"
    if industry not in cfg["industries"]:
        industry = "Other"

    bm = metrics.get("business_model") or ("B2B" if metrics.get("revenue", 0) > 500000 else "B2C")

    funding = metrics.get("funding_amount", 0) or 0
    revenue = metrics.get("revenue", 0) or 0
    if metrics.get("stage"):
        stage = metrics["stage"]
    elif funding < 250000:
        stage = "Pre-Seed"
    elif funding < 2000000:
        stage = "Seed"
    elif funding < 15000000:
        stage = "Series A"
    else:
        stage = "Series B"

    growth = metrics.get("customer_growth", 0) or 0
    runway = metrics.get("runway", 0) or 0
    if growth > 0.15 and runway > 9:
        profile = "high-growth"
    elif growth > 0.05:
        profile = "steady"
    elif runway < 6 or revenue < metrics.get("expenses", 0) * 0.5:
        profile = "struggling"
    else:
        profile = "early-stage"

    return {
        "industry": industry,
        "business_model": bm,
        "stage": stage,
        "profile": profile,
    }


def understand(metrics: dict[str, Any]) -> dict[str, Any]:
    prompt = render_prompt("startup_understanding", data=metrics)
    return llm.complete(prompt, mock_fn=lambda: _heuristic(metrics))
