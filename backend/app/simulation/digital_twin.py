"""Startup Digital Twin (Phase 7).

Maintains a virtual startup state and applies scenario multipliers from config.json.
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config


def build_state(metrics: dict[str, Any]) -> dict[str, Any]:
    return {
        "revenue": metrics.get("revenue", 0) or 0,
        "customers": metrics.get("customer_count", 0) or 0,
        "funding": metrics.get("funding_amount", 0) or 0,
        "burn_rate": metrics.get("burn_rate", 0) or 0,
        "expenses": metrics.get("expenses", 0) or 0,
        "growth_rate": metrics.get("customer_growth", 0) or 0,
        "market_share": metrics.get("market_share", 0.02) or 0.02,
    }


def apply_scenario(state: dict[str, Any], scenario: str) -> dict[str, Any]:
    multipliers = get_config()["simulation_multipliers"]
    mult = multipliers.get(scenario, {})
    new = dict(state)
    for key, pct in mult.items():
        target = {"customer_growth": "growth_rate"}.get(key, key)
        if target in new:
            new[target] = round(new[target] * (1 + pct), 2)
    # Derive customers from growth, runway from funding/burn
    new["customers"] = round(state["customers"] * (1 + new["growth_rate"]))
    if new["burn_rate"] > 0:
        new["runway"] = round(new["funding"] / new["burn_rate"], 1)
    return new


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k in after:
        b = before.get(k, 0) or 0
        a = after.get(k, 0) or 0
        change = a - b
        pct = (change / b * 100) if b else 0
        out[k] = {"before": b, "after": a, "change": round(change, 2), "pct": round(pct, 1)}
    return out
