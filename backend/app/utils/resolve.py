"""Resolve a StartupRef (db id OR inline questionnaire metrics) into a metrics dict.

No hardcoded/demo defaults: metrics come from the founder's questionnaire (inline) or
a persisted startup row. Missing numeric fields default to 0 so agents stay robust.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db import models
from app.db.schemas import StartupBase, StartupRef

# Numeric fields default to 0 only to avoid crashes; they are NOT demo values.
_NUMERIC_KEYS = [
    "revenue", "expenses", "burn_rate", "runway", "customer_count",
    "customer_growth", "churn_rate", "funding_amount", "employee_count", "valuation",
]


def resolve_metrics(ref: StartupRef, db: Session | None = None) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    if ref.startup_id is not None and db is not None:
        row = db.get(models.Startup, ref.startup_id)
        if row is not None:
            metrics.update({k: v for k, v in row.to_dict().items() if v is not None})
    if ref.metrics is not None:
        inline = ref.metrics.model_dump() if isinstance(ref.metrics, StartupBase) else dict(ref.metrics)
        metrics.update({k: v for k, v in inline.items() if v is not None})
    for k in _NUMERIC_KEYS:
        metrics.setdefault(k, 0)
    return metrics
