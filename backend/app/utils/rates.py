"""Canonical scale for the questionnaire's monthly rate fields.

THE POLICY, in one place, because a dozen agents read these numbers raw:

  `customer_growth` and `churn_rate` are FRACTIONS PER MONTH. 0.14 is 14% MoM.

Nothing enforced that before, and the questionnaire asks for a number in a box.
A founder who types 11.4 means 11.4% a month, not 1140%, but every consumer read
it literally: revenue_forecast clamped it to +40%/mo and back-cast an 18-month
history plus a 12-month projection off that, so a company doing $350K/month
plotted a 17,000x window and forecast $68M; health, failure_prediction,
funding_readiness, causal, specialists and digital_twin all read the same raw
value, so the whole board disagreed with reality in the same direction.

So: a magnitude ABOVE 1 is out of the documented domain and can only be a
percentage, and we divide it by 100 exactly once, then clamp to the field's
domain. Because every domain here is bounded by 1.0 in absolute value, a value
that has already been normalized can never trigger the divide again — the
function is idempotent, which is what lets us apply it at BOTH the API boundary
(schemas.StartupBase) and the read choke point (utils.resolve.resolve_metrics)
without any risk of dividing twice.

Applied in three places, so every consumer sees one number:
  - db/schemas.py      — inline `metrics` payloads and POST /startups
  - utils/resolve.py   — the merged dict every agent and model reads
  - api/routes/upload.py — CSV columns, which bypass the pydantic schema

Deliberately NOT applied to simulation/pivot.py's `customer_growth`: that is an
LLM-estimated impact score on a pivot proposal, a different field that merely
shares the name.
"""
from __future__ import annotations

from typing import Any, MutableMapping

# Domain of each rate field AFTER normalization, as (min, max).
#
# Both bounds sit within [-1, 1] on purpose: that is what makes normalize_rate
# idempotent (see the module docstring). Widening a bound past 1.0 would break
# that guarantee and re-divide already-clean values.
RATE_FIELDS: dict[str, tuple[float, float]] = {
    # -100%..+100% customers per month. Negative is legitimate (shrinking).
    "customer_growth": (-1.0, 1.0),
    # 0..100% of customers lost per month. Negative churn is not a thing here.
    "churn_rate": (0.0, 1.0),
}

# Above this magnitude the input cannot be a fraction, so it is a percentage.
_PERCENT_THRESHOLD = 1.0


def normalize_rate(value: Any, field: str) -> Any:
    """Coerce one rate to the canonical 0-1-per-month scale.

    11.4 -> 0.114 (read as a percentage), 0.114 -> 0.114 (already a fraction).
    Non-numeric input is returned untouched rather than guessed at; NaN (which
    pandas produces for an empty CSV cell) collapses to 0.0.
    """
    lo, hi = RATE_FIELDS[field]
    try:
        v = float(value)
    except (TypeError, ValueError):
        return value
    if v != v:  # NaN
        return 0.0
    if abs(v) > _PERCENT_THRESHOLD:
        v /= 100.0
    # round() first so 11.4/100 lands on 0.114 rather than 0.11399999999999999.
    return max(lo, min(hi, round(v, 6)))


def normalize_rates(metrics: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    """Normalize every rate field present in a metrics mapping, in place."""
    for field in RATE_FIELDS:
        if metrics.get(field) is not None:
            metrics[field] = normalize_rate(metrics[field], field)
    return metrics
