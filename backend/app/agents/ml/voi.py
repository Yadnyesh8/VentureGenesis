"""Value-of-Information engine (Feature 1) — the epistemic-uncertainty resolver.

For each decision-critical unknown, estimate the **Value of Information** (how much
resolving it could move the board-relevant probabilities) and compare it against the
**Cost** of acquiring it from the external knowledge connector. A fetch is requested only
when `VOI > Cost x (1 + margin)`, within a per-run fetch budget.

Two ways to estimate the value term, in priority order (ML-agent fallback convention):
1. **Model perturbation** — perturb a field the trained models consume and measure the
   swing in failure/funding probability (the field's true decision sensitivity).
2. **Config prior elasticity** — used when the trained models are unavailable.

Optionally accepts `causal_leverage` (from `causal.map_trajectory`): unknowns sitting on a
high-probability death path get their decision value amplified, so we spend the information
budget on the gaps that most change the trajectory.
"""
from __future__ import annotations

import logging
from typing import Any

from app.core import knowledge
from app.core.config import get_config

logger = logging.getLogger("venturegenesis.ml.voi")

# How a field is "resolved" toward a healthy value when perturbing for sensitivity.
_RESOLVE_TARGETS = {
    "runway": 18.0,
    "churn_rate": 0.05,
    "customer_growth": 0.20,
    "burn_rate": 0.0,  # interpreted as expenses brought to revenue parity below
}


def _present(metrics: dict[str, Any], field: str) -> bool:
    v = metrics.get(field)
    return v is not None and v != 0


def _model_sensitivity(metrics: dict[str, Any], field: str) -> float | None:
    """Half the absolute swing in (failure + funding) probability if `field` resolved.

    Returns None when the trained models are unavailable (caller falls back to priors).
    """
    try:
        from app.agents.ml.failure_prediction import predict_failure
        from app.agents.ml.funding_readiness import predict_funding
    except Exception:
        return None
    try:
        base_f = predict_failure(metrics)["failure_12m"]
        base_u = predict_funding(metrics)["funding_probability"]
    except Exception:
        return None

    pert = dict(metrics)
    if field == "burn_rate":
        pert["expenses"] = metrics.get("revenue", 0) or 0  # burn neutralized
    elif field in _RESOLVE_TARGETS:
        pert[field] = _RESOLVE_TARGETS[field]
    else:
        return None

    try:
        new_f = predict_failure(pert)["failure_12m"]
        new_u = predict_funding(pert)["funding_probability"]
    except Exception:
        return None
    return (abs(new_f - base_f) + abs(new_u - base_u)) / 2.0


def assess(metrics: dict[str, Any], *, allow_fetch: bool = False,
           causal_leverage: dict[str, float] | None = None) -> dict[str, Any]:
    """Rank decision-critical unknowns by VOI vs cost; optionally fetch the worth-it ones."""
    cfg = get_config()["voi"]
    weights = cfg["decision_value_weights"]
    priors = cfg["prior_elasticity"]
    field_source = cfg["field_source"]
    margin = cfg["fetch_margin"]
    scale = cfg["cost_to_voi_scale"]
    max_fetches = cfg["max_fetches_per_run"]
    causal_leverage = causal_leverage or {}

    knowledge.reset_run()
    ledger: list[dict[str, Any]] = []

    for field in cfg["candidate_fields"]:
        # A gap is a field we don't have a real value for: external fields are never in the
        # questionnaire (always gaps); supplied KPIs count as known unless zero/missing.
        if _present(metrics, field):
            continue

        sens = _model_sensitivity(metrics, field) if field in _RESOLVE_TARGETS else None
        basis = "model_perturbation" if sens is not None else "prior_elasticity"
        if sens is None:
            sens = priors.get(field, 0.05)

        decision_value = weights.get(field, 0.5)
        leverage_boost = 1.0 + causal_leverage.get(field, 0.0)
        voi = round(sens * decision_value * leverage_boost, 4)

        source = field_source.get(field, "web_search")
        cost = knowledge.cost_of(source)
        cost_in_voi = cost * scale
        worth_it = voi > cost_in_voi * (1 + margin)

        ledger.append({
            "field": field,
            "voi": voi,
            "basis": basis,
            "decision_value": decision_value,
            "source": source,
            "cost_usd": cost,
            "cost_in_voi_units": round(cost_in_voi, 4),
            "worth_fetching": worth_it,
            "fetched": False,
        })

    ledger.sort(key=lambda x: x["voi"], reverse=True)

    fetched_count = 0
    for item in ledger:
        if not item["worth_fetching"] or not allow_fetch:
            continue
        if fetched_count >= max_fetches:
            item["skipped_reason"] = "fetch budget exhausted"
            continue
        res = knowledge.fetch(item["source"], f'{item["field"]} for this startup')
        item["fetched"] = bool(res.get("available"))
        item["fetch_result"] = res if res.get("available") else None
        item["fetch_reason"] = res.get("reason")
        if item["fetched"]:
            fetched_count += 1

    return {
        "ledger": ledger,
        "top_unknown": ledger[0]["field"] if ledger else None,
        "fetches_made": fetched_count,
        "spend": knowledge.ledger(),
        "allow_fetch": allow_fetch,
    }
