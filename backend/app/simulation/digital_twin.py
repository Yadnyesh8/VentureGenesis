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


def apply_scenario_to_metrics(metrics: dict[str, Any], scenario: str) -> dict[str, Any]:
    """Apply the scenario multipliers to the founder's real metrics dict, so the trained
    models can be re-run on the simulated company (the 'complex' part of the engine)."""
    mult = get_config()["simulation_multipliers"].get(scenario, {})
    m = dict(metrics)
    revenue = (m.get("revenue") or 0) * (1 + mult.get("revenue", 0))
    expenses = (m.get("expenses") or 0) * (1 + mult.get("expenses", 0))
    burn_old = m.get("burn_rate") or 0
    burn = burn_old * (1 + mult.get("burn_rate", 0))
    # growth delta can come from either "customer_growth" or "growth_rate" keys
    g_delta = mult.get("customer_growth", 0) + mult.get("growth_rate", 0)
    growth = (m.get("customer_growth") or 0) * (1 + g_delta) if (m.get("customer_growth") or 0) else g_delta
    customers = round((m.get("customer_count") or 0) * (1 + g_delta))
    # runway scales inversely with burn (runway ~ cash / burn)
    runway = m.get("runway") or 0
    if burn_old > 0 and burn > 0:
        runway = round(runway * burn_old / burn, 1)
    m.update({
        "revenue": round(revenue, 2),
        "expenses": round(expenses, 2),
        "burn_rate": round(burn, 2),
        "customer_growth": round(growth, 4),
        "customer_count": customers,
        "runway": runway,
    })
    return m


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k in after:
        b = before.get(k, 0) or 0
        a = after.get(k, 0) or 0
        change = a - b
        pct = (change / b * 100) if b else 0
        out[k] = {"before": b, "after": a, "change": round(change, 2), "pct": round(pct, 1)}
    return out
