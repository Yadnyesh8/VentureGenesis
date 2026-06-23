"""Failure Prediction Agent (Phase 4) — trained on REAL data.

Base probability comes from a GradientBoosting model trained on 6,000+ real YC/Failory
company outcomes (see app/ml_training/train.py). That base is then adjusted by a
transparent financial-risk layer using the founder's own questionnaire numbers
(runway, churn, growth, burn) — neither of which is synthetic.

There is no mock/heuristic substitute: if the trained model is missing the call raises.
SHAP explainability is layered on the trained model when the `shap` package is present.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.core.config import get_config
from app.ml_training import loader
from app.ml_training.features import metrics_to_features, FEATURE_NAMES

logger = logging.getLogger("venturegenesis.ml.failure")

try:
    import shap  # type: ignore

    _HAS_SHAP = True
except Exception:  # pragma: no cover
    _HAS_SHAP = False


def _financial_adjustment(metrics: dict[str, Any]) -> tuple[float, list[dict]]:
    """Risk delta from the user's real financial inputs (weights/clamps in config.json)."""
    cfg = get_config()
    thr = cfg["failure_thresholds"]
    adj = cfg["failure_adjustment"]
    runway = metrics.get("runway", 0) or 0
    churn = metrics.get("churn_rate", 0) or 0
    growth = metrics.get("customer_growth", 0) or 0
    revenue = metrics.get("revenue", 0) or 0
    expenses = metrics.get("expenses", 0) or 0
    burn_ratio = (expenses - revenue) / (expenses + 1)

    contributions = {}
    r = max(0.0, (thr["critical_runway_months"] - runway) / thr["critical_runway_months"]) * adj["runway_weight"]
    contributions["runway"] = round(r, 3)
    c = min(churn / max(thr["high_churn_rate"], 0.01), adj["churn_cap_multiple"]) * adj["churn_weight"]
    contributions["churn_rate"] = round(c, 3)
    g = min(max(0.0, -growth) * 2.0, 1.0) * adj["negative_growth_weight"]
    contributions["customer_growth"] = round(g, 3)
    # Burn only penalized above the high_burn_ratio threshold, scaled to its max at ratio 1.0.
    excess_burn = max(0.0, burn_ratio - thr["high_burn_ratio"]) / max(1.0 - thr["high_burn_ratio"], 0.01)
    b = min(excess_burn, 1.0) * adj["burn_weight"]
    contributions["burn_rate"] = round(b, 3)
    delta = sum(contributions.values()) - adj["healthy_baseline_credit"]
    delta = max(adj["delta_min"], min(adj["delta_max"], delta))
    fin_importance = [{"feature": k, "impact": v} for k, v in sorted(contributions.items(), key=lambda x: -x[1])]
    return delta, fin_importance


def predict_failure(metrics: dict[str, Any]) -> dict[str, Any]:
    """Predict failure risk from the trained model + the founder's real financials.

    No heuristic/mock substitute: if the trained model is unavailable, this raises so the
    caller surfaces a real error instead of inventing numbers.
    """
    bundle = loader.load_bundle("failure_model")
    if bundle is None:
        raise RuntimeError(
            "failure_model not trained. Run: python -m app.ml_training.train"
        )

    model = bundle["model"]
    industry_map = bundle["industry_map"]
    x = np.array([metrics_to_features(metrics, industry_map)])
    base_ml = float(model.predict_proba(x)[0][1])

    # Real financial-risk layer over the founder's own numbers (not a fallback).
    delta, fin_importance = _financial_adjustment(metrics)
    base = min(max(base_ml + delta, 0.02), 0.98)

    # Model feature importances (permutation importances saved at train time for
    # calibrated pipelines; raw tree importances for legacy bundles) + financial contributions.
    feature_importance = []
    saved = bundle.get("feature_importances")
    if saved:
        for name, imp in sorted(saved.items(), key=lambda t: -t[1]):
            feature_importance.append({"feature": name, "impact": round(float(imp), 4)})
    else:
        importances = getattr(model, "feature_importances_", None)
        if importances is not None:
            for name, imp in sorted(zip(FEATURE_NAMES, importances), key=lambda t: -t[1]):
                feature_importance.append({"feature": name, "impact": round(float(imp), 4)})
    feature_importance.extend(fin_importance)

    shap_ok = False
    if _HAS_SHAP:
        try:
            explainer = shap.TreeExplainer(model)
            vals = np.array(explainer.shap_values(x)).reshape(-1)
            feature_importance = [
                {"feature": FEATURE_NAMES[i], "impact": round(float(vals[i]), 4)}
                for i in np.argsort(-np.abs(vals))
            ] + fin_importance
            shap_ok = True
        except Exception as exc:  # pragma: no cover
            logger.info("SHAP failed: %s", exc)

    # Cumulative failure probability must be non-decreasing with the horizon: a longer
    # window can only add risk. So six_month < 1 (less time to fail) and two_year > 1.
    horizons = get_config().get("failure_horizons", {})
    six_m = horizons.get("six_month_multiplier", 0.6)
    two_y = horizons.get("two_year_multiplier", 1.5)

    return {
        "failure_6m": round(min(base * six_m, 0.99), 3),
        "failure_12m": round(base, 3),
        "failure_24m": round(min(base * two_y, 0.99), 3),
        "method": f"{bundle['model_type']} (trained on {bundle['n_samples']} real companies, AUC {bundle['metrics']['auc']})",
        "model_base_probability": round(base_ml, 3),
        "financial_adjustment": round(delta, 3),
        "feature_importance": feature_importance,
        "shap_available": shap_ok,
        "trained": True,
    }
