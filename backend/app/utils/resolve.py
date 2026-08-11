"""Resolve a StartupRef (db id OR inline questionnaire metrics) into a metrics dict.

No hardcoded/demo defaults: metrics come from the founder's questionnaire (inline) or
a persisted startup row. Missing numeric fields default to 0 so agents stay robust.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db import models
from app.db.schemas import StartupBase, StartupRef
from app.utils.rates import normalize_rates

# Numeric fields default to 0 only to avoid crashes; they are NOT demo values.
_NUMERIC_KEYS = [
    "revenue", "expenses", "burn_rate", "runway", "customer_count",
    "customer_growth", "churn_rate", "funding_amount", "employee_count", "valuation",
]

# A profitable company (no monthly burn) has effectively unbounded runway. Kept in sync
# with the frontend sentinel (components/ui.tsx RUNWAY_INFINITE).
RUNWAY_INFINITE = 9999


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

    # Single canonical scale for the monthly rates. This is the choke point EVERY agent
    # and model reads through, so normalizing here is what keeps the forecast page from
    # disagreeing with health, failure and funding: they all see the same number. It
    # also covers rows the pydantic schema never saw (CSV imports, rows written before
    # this policy existed). normalize_rate is idempotent, so the double pass is a no-op.
    normalize_rates(metrics)

    # Profitable / zero-burn guard: a company with no monthly burn has effectively
    # unbounded runway. Without this, burn=0 would leave runway at 0 and every
    # runway-dependent agent (failure adjustment, causal death path, VOI) would read
    # it as imminent cash-out — the "0% burn ⇒ 90% death" defect. We normalize it to a
    # large sentinel so those agents see a healthy, not fatal, runway.
    burn = metrics.get("burn_rate", 0) or 0
    if burn <= 0 and (metrics.get("runway", 0) or 0) <= 0:
        metrics["runway"] = RUNWAY_INFINITE
    return metrics
