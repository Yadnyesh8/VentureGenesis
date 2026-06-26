"""Per-prediction model confidence.

A predicted probability (e.g. "72% failure risk") is not the same as how much you should
*trust* that number. This module turns the model's own quality signals plus the
completeness of the founder's input into a single 0-100 **model confidence** score, so the
UI can show "Failure risk 72% · model confidence 91%" rather than implying false precision.

Confidence blends four transparent, defensible signals (weights in
`config.json -> confidence`, internal defaults otherwise):

1. **Discrimination** — held-out ROC-AUC of the trained model (how well it separates
   outcomes at all). 0.5 = coin flip, 1.0 = perfect.
2. **Calibration** — 1 − (Brier / brier_ref): how close predicted probabilities are to
   observed frequencies. A well-calibrated model earns more trust.
3. **Stability** — 1 − normalized cross-validation AUC std: a model whose skill is steady
   across folds is more trustworthy than one that swings.
4. **Input completeness** — fraction of the decision-critical KPIs the founder actually
   supplied. Predicting from 3 of 8 fields should read as less confident.

Pure and deterministic; never raises (returns a neutral score if a bundle lacks metrics).
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config

_DEFAULTS = {
    "weights": {
        "discrimination": 0.35,
        "calibration": 0.30,
        "stability": 0.15,
        "completeness": 0.20,
    },
    "brier_reference": 0.25,        # Brier of an uninformative 0.5-everywhere model.
    "cv_std_reference": 0.10,       # CV-AUC std treated as "fully unstable".
    "floor": 0.30,                  # Never report absurdly low/high confidence.
    "ceiling": 0.98,
    # KPIs that materially drive the decision; completeness is measured over these.
    "decision_fields": [
        "runway", "churn_rate", "customer_growth", "revenue",
        "expenses", "burn_rate", "employee_count", "funding_amount",
    ],
}


def _cfg() -> dict[str, Any]:
    block = get_config().get("confidence", {}) or {}
    merged = dict(_DEFAULTS)
    merged.update(block)
    if "weights" in block:  # shallow-merge weights so a partial override still works
        w = dict(_DEFAULTS["weights"])
        w.update(block["weights"])
        merged["weights"] = w
    return merged


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def input_completeness(metrics: dict[str, Any], fields: list[str] | None = None) -> float:
    """Fraction of decision-critical KPIs the founder actually supplied (non-zero/non-null)."""
    fields = fields or _cfg()["decision_fields"]
    if not fields:
        return 1.0
    present = sum(1 for f in fields if metrics.get(f) not in (None, 0, 0.0, ""))
    return present / len(fields)


def model_confidence(metrics: dict[str, Any], bundle_metrics: dict[str, Any] | None) -> dict[str, Any]:
    """Blend model-quality + input-completeness signals into a 0-100 confidence score.

    `bundle_metrics` is the trained bundle's `metrics` dict (auc, brier, cv_auc_std, ...).
    Returns the score plus its component breakdown so the UI can explain it.
    """
    cfg = _cfg()
    w = cfg["weights"]
    bm = bundle_metrics or {}

    auc = bm.get("auc")
    brier = bm.get("brier")
    cv_std = bm.get("cv_auc_std")

    # 1) Discrimination: rescale AUC from [0.5,1.0] → [0,1] (0.5 AUC carries no information).
    discrimination = _clamp((float(auc) - 0.5) / 0.5) if isinstance(auc, (int, float)) else 0.5
    # 2) Calibration: 1 − Brier/ref, so a perfectly calibrated model → 1.
    calibration = _clamp(1 - float(brier) / cfg["brier_reference"]) if isinstance(brier, (int, float)) else 0.5
    # 3) Stability: steadier CV skill → higher.
    stability = _clamp(1 - float(cv_std) / cfg["cv_std_reference"]) if isinstance(cv_std, (int, float)) else 0.5
    # 4) Completeness of the founder's own inputs.
    completeness = input_completeness(metrics)

    raw = (
        w["discrimination"] * discrimination
        + w["calibration"] * calibration
        + w["stability"] * stability
        + w["completeness"] * completeness
    )
    score = _clamp(raw, cfg["floor"], cfg["ceiling"])

    return {
        "model_confidence": round(score * 100, 1),
        "components": {
            "discrimination": round(discrimination, 3),
            "calibration": round(calibration, 3),
            "stability": round(stability, 3),
            "input_completeness": round(completeness, 3),
        },
        "basis": "held-out AUC + Brier calibration + CV stability + input completeness",
    }
