"""Revenue Forecast Agent (Phase 4).

Uses Facebook Prophet on a revenue time series when available; otherwise a
trend + seasonality-free linear/compound-growth fallback.
Outputs 3m / 6m / 12m forecasts plus a monthly series for charting.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np

logger = logging.getLogger("venturegenesis.ml.forecast")

try:
    from prophet import Prophet  # type: ignore
    import pandas as pd

    _HAS_PROPHET = True
except Exception:  # pragma: no cover
    _HAS_PROPHET = False


def _synthesize_series(metrics: dict[str, Any], months: int = 18) -> list[float]:
    """Build a plausible historical monthly revenue series from current metrics."""
    current_monthly = (metrics.get("revenue", 0) or 0) / 12.0
    if current_monthly <= 0:
        return []  # no revenue reported — caller handles "no data"
    growth = metrics.get("customer_growth", 0.0) or 0.0
    g = max(min(growth, 0.4), -0.2)
    # Deterministic back-cast of monthly revenue from the founder's reported figures
    # (no random noise — purely derived from real inputs).
    series = []
    val = current_monthly / ((1 + g) ** months)
    for _ in range(months):
        val *= (1 + g)
        series.append(max(round(val, 2), 0))
    return series


def _fallback_forecast(series: list[float]) -> dict[str, Any]:
    arr = np.array(series[-12:]) if len(series) >= 3 else np.array(series)
    if len(arr) >= 2:
        ratios = arr[1:] / np.clip(arr[:-1], 1, None)
        g = float(np.clip(np.median(ratios) - 1, -0.2, 0.4))
    else:
        g = 0.05
    last = float(arr[-1]) if len(arr) else 50000.0

    def project(n):
        return [round(last * ((1 + g) ** k), 2) for k in range(1, n + 1)]

    proj12 = project(12)
    return {
        "forecast_3m": round(sum(proj12[:3]), 2),
        "forecast_6m": round(sum(proj12[:6]), 2),
        "forecast_12m": round(sum(proj12), 2),
        "monthly_growth_rate": round(g, 4),
        "series": [round(s, 2) for s in series],
        "projection": proj12,
        "method": "compound_growth_fallback",
    }


def forecast_revenue(metrics: dict[str, Any], series: list[float] | None = None) -> dict[str, Any]:
    series = series or _synthesize_series(metrics)
    if not series:
        return {
            "forecast_3m": None, "forecast_6m": None, "forecast_12m": None,
            "series": [], "projection": [], "method": "no_input",
            "note": "Report current revenue (or a revenue history) to forecast.",
        }
    if not _HAS_PROPHET or len(series) < 6:
        return _fallback_forecast(series)
    try:
        start = datetime.utcnow() - timedelta(days=30 * len(series))
        df = pd.DataFrame(
            {
                "ds": [start + timedelta(days=30 * i) for i in range(len(series))],
                "y": series,
            }
        )
        m = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
        m.fit(df)
        future = m.make_future_dataframe(periods=12, freq="MS")
        fc = m.predict(future)
        proj = fc["yhat"].tail(12).clip(lower=0).tolist()
        return {
            "forecast_3m": round(float(sum(proj[:3])), 2),
            "forecast_6m": round(float(sum(proj[:6])), 2),
            "forecast_12m": round(float(sum(proj)), 2),
            "series": [round(s, 2) for s in series],
            "projection": [round(p, 2) for p in proj],
            "method": "prophet",
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("Prophet failed (%s); fallback", exc)
        return _fallback_forecast(series)
