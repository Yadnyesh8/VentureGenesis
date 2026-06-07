"""Failure Prediction Agent (Phase 4) — trained on REAL data.

Base probability comes from a GradientBoosting model trained on 6,000+ real YC/Failory
company outcomes (see app/ml_training/train.py). That base is then adjusted by a
transparent financial-risk layer using the founder's own questionnaire numbers
(runway, churn, growth, burn) — neither of which is synthetic.

Falls back to a pure rule-based scorer if the trained model is missing.
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
    """Risk delta in [-0.25, +0.45] from the user's real financial inputs."""
    cfg = get_config()["failure_thresholds"]
    runway = metrics.get("runway", 0) or 0
    churn = metrics.get("churn_rate", 0) or 0
    growth = metrics.get("customer_growth", 0) or 0
    revenue = metrics.get("revenue", 0) or 0
    expenses = metrics.get("expenses", 0) or 0
    burn_ratio = (expenses - revenue) / (expenses + 1)

    contributions = {}
    r = max(0.0, (cfg["critical_runway_months"] - runway) / cfg["critical_runway_months"]) * 0.20
    contributions["runway"] = round(r, 3)
    c = min(churn / max(cfg["high_churn_rate"], 0.01), 1.5) * 0.12
    contributions["churn_rate"] = round(c, 3)
    g = max(0.0, -growth) * 2.0 * 0.08
    contributions["customer_growth"] = round(g, 3)
    b = max(0.0, burn_ratio) * 0.05
    contributions["burn_rate"] = round(b, 3)
    delta = sum(contributions.values()) - 0.05  # small healthy-baseline credit
    delta = max(-0.25, min(0.45, delta))
    fin_importance = [{"feature": k, "impact": v} for k, v in sorted(contributions.items(), key=lambda x: -x[1])]
    return delta, fin_importance


def _rule_based(metrics: dict[str, Any]) -> dict[str, Any]:
    delta, fin_importance = _financial_adjustment(metrics)
    base = min(max(0.30 + delta, 0.02), 0.97)
    return {
        "failure_6m": round(min(base * 1.15, 0.99), 3),
        "failure_12m": round(base, 3),
        "failure_24m": round(min(base * 0.85, 0.99), 3),
        "method": "rule_based",
        "feature_importance": fin_importance,
        "shap_available": False,
        "trained": False,
    }


def predict_failure(metrics: dict[str, Any]) -> dict[str, Any]:
    bundle = loader.load_bundle("failure_model")
    if bundle is None:
        return _rule_based(metrics)
    try:
        model = bundle["model"]
        industry_map = bundle["industry_map"]
        x = np.array([metrics_to_features(metrics, industry_map)])
        base_ml = float(model.predict_proba(x)[0][1])

        delta, fin_importance = _financial_adjustment(metrics)
        base = min(max(base_ml + delta, 0.02), 0.98)

        # Model feature importances (data-driven) + financial contributions.
        importances = getattr(model, "feature_importances_", None)
        feature_importance = []
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

        return {
            "failure_6m": round(min(base * 1.12, 0.99), 3),
            "failure_12m": round(base, 3),
            "failure_24m": round(min(base * 0.88, 0.99), 3),
            "method": f"{bundle['model_type']} (trained on {bundle['n_samples']} real companies, AUC {bundle['metrics']['auc']})",
            "model_base_probability": round(base_ml, 3),
            "financial_adjustment": round(delta, 3),
            "feature_importance": feature_importance,
            "shap_available": shap_ok,
            "trained": True,
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("Trained failure predict failed (%s); rule-based", exc)
        return _rule_based(metrics)
