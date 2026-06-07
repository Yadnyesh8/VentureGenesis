"""Customer Churn Agent (Phase 4).

There is no labeled churn dataset bundled with the project, so rather than train on
synthetic/random data we compute churn risk transparently from the founder's real
inputs (reported churn rate vs. growth). If the user later provides a labeled churn
dataset, a CatBoost/GradientBoosting model can be trained here the same way as
failure/funding.
"""
from __future__ import annotations

from typing import Any


def predict_churn(metrics: dict[str, Any]) -> dict[str, Any]:
    churn = metrics.get("churn_rate", None)
    growth = metrics.get("customer_growth", 0) or 0
    if churn is None:
        # Nothing reported — signal that input is needed instead of inventing a number.
        return {"churn_risk": None, "retention_score": None, "method": "no_input"}
    churn = float(churn)
    # Risk rises with reported churn, mitigated by growth (net retention proxy).
    risk = min(max(churn * 4 - growth, 0.0), 0.98)
    return {
        "churn_risk": round(risk, 3),
        "retention_score": round((1 - risk) * 100, 1),
        "method": "founder_reported_metrics",
    }
