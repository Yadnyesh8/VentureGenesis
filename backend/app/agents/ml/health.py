"""Startup Health Agent (Phase 4).

Weighted scoring formula (weights from config.json):
  Revenue Strength 25%, Growth Rate 25%, Funding Readiness 20%,
  Customer Health 15%, Market Position 15%
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_health(metrics: dict[str, Any], funding_prob: float | None = None) -> dict[str, Any]:
    cfg = get_config()
    w = cfg["health_weights"]
    n = cfg["health_norms"]

    revenue = metrics.get("revenue", 0) or 0
    expenses = metrics.get("expenses", 0) or 1
    growth = metrics.get("customer_growth", 0) or 0
    valuation = metrics.get("valuation", 0) or 0

    revenue_strength = _clamp01(revenue / (expenses + 1))  # >=1 means profitable-ish
    revenue_strength = _clamp01(min(revenue / n["revenue_scale"], 1) * 0.5 + revenue_strength * 0.5)
    growth_rate = _clamp01((growth + n["growth_offset"]) / n["growth_range"])
    funding_readiness = funding_prob if funding_prob is not None else _clamp01(
        (metrics.get("runway", 0) or 0) / n["runway_norm_months"]
    )
    # Customer health derives from the founder's reported churn rate (lower churn = healthier).
    customer_health = _clamp01(1 - (metrics.get("churn_rate", n["default_churn"]) or n["default_churn"]))
    market_position = _clamp01(
        min(valuation / n["valuation_scale"], 1) * 0.6 + min(growth / n["growth_norm"], 1) * 0.4
    )

    components = {
        "revenue_strength": round(revenue_strength * 100, 1),
        "growth_rate": round(growth_rate * 100, 1),
        "funding_readiness": round(funding_readiness * 100, 1),
        "customer_health": round(customer_health * 100, 1),
        "market_position": round(market_position * 100, 1),
    }

    health_score = (
        revenue_strength * w["revenue_strength"]
        + growth_rate * w["growth_rate"]
        + funding_readiness * w["funding_readiness"]
        + customer_health * w["customer_health"]
        + market_position * w["market_position"]
    ) * 100

    grade = (
        "A" if health_score >= 80 else
        "B" if health_score >= 65 else
        "C" if health_score >= 50 else
        "D" if health_score >= 35 else "F"
    )
    return {
        "health_score": round(health_score, 1),
        "grade": grade,
        "components": components,
        "weights": w,
    }
