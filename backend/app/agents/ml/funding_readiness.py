"""Funding Readiness Agent (Phase 4) — trained on REAL data.

Base probability from a GradientBoosting model trained on real YC/Failory outcomes
(success = Acquired/Public/top-company). Adjusted by the founder's real traction
inputs (runway, growth, revenue). No mock/heuristic substitute: if the trained model is
missing the call raises.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.core.config import get_config
from app.ml_training import loader
from app.ml_training.features import metrics_to_features

logger = logging.getLogger("venturegenesis.ml.funding")


def _traction_adjustment(metrics: dict[str, Any]) -> float:
    """Delta from real traction numbers (weights/norms in config.json -> funding_adjustment)."""
    cfg = get_config()
    adj = cfg["funding_adjustment"]
    critical_runway = cfg["failure_thresholds"]["critical_runway_months"]
    runway = metrics.get("runway", 0) or 0
    growth = metrics.get("customer_growth", 0) or 0
    revenue = metrics.get("revenue", 0) or 0
    d = 0.0
    d += min(max(growth, 0) / adj["growth_norm"], 1) * adj["growth_weight"]
    d += min(runway / adj["runway_norm_months"], 1) * adj["runway_weight"]
    d += min(revenue / adj["revenue_norm"], 1) * adj["revenue_weight"]
    d -= adj["low_runway_penalty"] if runway < critical_runway else 0.0
    return max(adj["delta_min"], min(adj["delta_max"], d))


def predict_funding(metrics: dict[str, Any]) -> dict[str, Any]:
    bundle = loader.load_bundle("funding_model")
    if bundle is None:
        raise RuntimeError(
            "funding_model not trained. Run: python -m app.ml_training.train"
        )
    model = bundle["model"]
    x = np.array([metrics_to_features(metrics, bundle["industry_map"])])
    base = float(model.predict_proba(x)[0][1])
    prob = max(0.02, min(0.98, base + _traction_adjustment(metrics)))
    return {
        "funding_probability": round(prob, 3),
        "investor_score": round(prob * 100, 1),
        "model_base_probability": round(base, 3),
        "method": f"{bundle['model_type']} (trained on {bundle['n_samples']} real companies, AUC {bundle['metrics']['auc']})",
        "trained": True,
    }
