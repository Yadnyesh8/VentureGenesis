"""Train real ML models on the bundled YC + Failory datasets (no synthetic data).

Two models, both saved to ../models/ as joblib bundles:

  failure_model.joblib  — P(startup becomes Inactive/dead)
      target: status == "Inactive"  -> 1, else 0
  funding_model.joblib  — P(startup reaches a fundable/success outcome)
      target: status in {"Acquired","Public"} OR top_company -> 1, else 0

Enterprise-grade training pipeline:
  - Leakage-safe target encoding of industry (sklearn TargetEncoder, cross-fitted)
  - HistGradientBoosting with a small hyperparameter grid search (5-fold stratified CV)
  - Isotonic probability calibration (CalibratedClassifierCV) so output probabilities
    are trustworthy, not just well-ranked
  - Honest evaluation: cross-validated AUC, PR-AUC, Brier score, holdout metrics
  - Permutation feature importances stored in the bundle (model-agnostic)

Run:  python -m app.ml_training.train
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import TargetEncoder

from app.ml_training.features import (
    FEATURE_NAMES,
    INDUSTRY_COL_INDEX,
    row_to_features_training,
)

BASE = Path(__file__).resolve().parent.parent.parent  # backend/
DATA = Path(os.getenv("VG_DATA_DIR", BASE.parent / "data"))
MODELS = Path(os.getenv("VG_MODELS_DIR", BASE.parent / "models"))

CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# Small feature space (6 features) -> heavily regularized trees generalize best.
PARAM_GRID = {
    "clf__learning_rate": [0.03, 0.05],
    "clf__max_leaf_nodes": [7, 15],
    "clf__min_samples_leaf": [40, 80],
    "clf__l2_regularization": [0.0, 1.0],
    "clf__class_weight": [None, "balanced"],
}


def _load_dataset() -> pd.DataFrame:
    frames = []
    yc = DATA / "yc_companies_algolia.csv"
    fl = DATA / "failory_dataset_yc_format.csv"
    if yc.exists():
        frames.append(pd.read_csv(yc))
    if fl.exists():
        frames.append(pd.read_csv(fl))
    if not frames:
        raise FileNotFoundError(f"No datasets found in {DATA}")
    df = pd.concat(frames, ignore_index=True)
    df = df[df["status"].notna()]
    return df


def _build_industry_map(df: pd.DataFrame) -> dict[str, int]:
    inds = sorted(str(x).strip() for x in df["industry"].dropna().unique())
    return {name: i for i, name in enumerate(inds)}


def _featurize(df: pd.DataFrame, industry_map: dict[str, int]) -> np.ndarray:
    rows = df.to_dict(orient="records")
    return np.array([row_to_features_training(r, industry_map) for r in rows], dtype=float)


def _make_pipeline() -> Pipeline:
    """TargetEncoder (cross-fitted -> leakage-safe) on industry + HistGradientBoosting."""
    encoder = ColumnTransformer(
        transformers=[
            ("industry_te", TargetEncoder(target_type="binary", random_state=42), [INDUSTRY_COL_INDEX]),
        ],
        remainder="passthrough",
    )
    clf = HistGradientBoostingClassifier(max_iter=400, random_state=42)
    return Pipeline([("encode", encoder), ("clf", clf)])


def _best_f1_threshold(y_true: np.ndarray, proba: np.ndarray) -> tuple[float, float]:
    best_t, best_f1 = 0.5, 0.0
    for t in np.arange(0.1, 0.9, 0.02):
        f1 = f1_score(y_true, (proba >= t).astype(int), zero_division=0)
        if f1 > best_f1:
            best_t, best_f1 = float(t), float(f1)
    return round(best_t, 2), round(best_f1, 4)


def _train_one(X, y, name: str, industry_map: dict[str, int]) -> dict:
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 1) Hyperparameter search on the training split (5-fold stratified CV on AUC).
    search = GridSearchCV(_make_pipeline(), PARAM_GRID, cv=CV, scoring="roc_auc", n_jobs=-1)
    search.fit(Xtr, ytr)
    cv_auc_mean = float(search.cv_results_["mean_test_score"][search.best_index_])
    cv_auc_std = float(search.cv_results_["std_test_score"][search.best_index_])

    # 2) Calibrate the tuned model so probabilities are usable as real risk estimates.
    model = CalibratedClassifierCV(search.best_estimator_, method="isotonic", cv=CV)
    model.fit(Xtr, ytr)

    # 3) Honest holdout evaluation.
    proba = model.predict_proba(Xte)[:, 1]
    auc = float(roc_auc_score(yte, proba)) if len(set(yte)) > 1 else float("nan")
    pr_auc = float(average_precision_score(yte, proba))
    brier = float(brier_score_loss(yte, proba))
    acc = float(accuracy_score(yte, (proba >= 0.5).astype(int)))
    thr, f1 = _best_f1_threshold(yte, proba)

    # 4) Model-agnostic feature importances (calibrated pipelines hide tree importances).
    perm = permutation_importance(model, Xte, yte, scoring="roc_auc", n_repeats=10, random_state=42, n_jobs=-1)
    importances = {n: round(float(v), 4) for n, v in zip(FEATURE_NAMES, perm.importances_mean)}

    bundle = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "industry_map": industry_map,
        "feature_importances": importances,
        "best_params": {k.replace("clf__", ""): v for k, v in search.best_params_.items()},
        "metrics": {
            "auc": round(auc, 4),
            "accuracy": round(acc, 4),
            "pr_auc": round(pr_auc, 4),
            "brier": round(brier, 4),
            "cv_auc_mean": round(cv_auc_mean, 4),
            "cv_auc_std": round(cv_auc_std, 4),
            "best_f1": f1,
            "best_f1_threshold": thr,
        },
        "n_samples": int(len(X)),
        "positives": int(y.sum()),
        "model_type": "HistGradientBoosting (calibrated)",
    }
    MODELS.mkdir(parents=True, exist_ok=True)
    out = MODELS / f"{name}.joblib"
    joblib.dump(bundle, out)
    print(
        f"  ✓ {name}: n={len(X)} pos={int(y.sum())} "
        f"AUC={auc:.3f} PR-AUC={pr_auc:.3f} Brier={brier:.3f} acc={acc:.3f} "
        f"CV-AUC={cv_auc_mean:.3f}±{cv_auc_std:.3f} params={bundle['best_params']} -> {out}"
    )
    return bundle


def main():
    print("Loading real datasets…")
    df = _load_dataset()
    industry_map = _build_industry_map(df)
    print(f"  {len(df)} companies, {len(industry_map)} industries")

    X = _featurize(df, industry_map)
    status = df["status"].astype(str).str.strip().str.lower()

    # Failure model
    y_fail = (status == "inactive").astype(int).to_numpy()
    # Funding/success model
    top = df.get("top_company")
    top_bool = top.astype(str).str.lower().eq("true").to_numpy() if top is not None else np.zeros(len(df), bool)
    y_fund = (status.isin(["acquired", "public"]).to_numpy() | top_bool).astype(int)

    print("Training failure model…")
    _train_one(X, y_fail, "failure_model", industry_map)
    print("Training funding model…")
    _train_one(X, y_fund, "funding_model", industry_map)
    print("Done. Features used:", FEATURE_NAMES)


if __name__ == "__main__":
    main()
