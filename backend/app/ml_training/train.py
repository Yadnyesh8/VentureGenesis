"""Train real ML models on the bundled YC + Failory datasets (no synthetic data).

Two models, both saved to ../models/ as joblib bundles:

  failure_model.joblib  — P(startup becomes Inactive/dead)
      target: status == "Inactive"  -> 1, else 0
  funding_model.joblib  — P(startup reaches a fundable/success outcome)
      target: status in {"Acquired","Public"} OR top_company -> 1, else 0

Run:  python -m app.ml_training.train
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score

from app.ml_training.features import (
    FEATURE_NAMES,
    row_to_features_training,
)

BASE = Path(__file__).resolve().parent.parent.parent  # backend/
DATA = Path(os.getenv("VG_DATA_DIR", BASE.parent / "data"))
MODELS = Path(os.getenv("VG_MODELS_DIR", BASE.parent / "models"))


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


def _train_one(X, y, name: str, industry_map: dict[str, int]) -> dict:
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    clf = GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.07, random_state=42)
    clf.fit(Xtr, ytr)
    proba = clf.predict_proba(Xte)[:, 1]
    preds = (proba >= 0.5).astype(int)
    auc = float(roc_auc_score(yte, proba)) if len(set(yte)) > 1 else float("nan")
    acc = float(accuracy_score(yte, preds))
    bundle = {
        "model": clf,
        "feature_names": FEATURE_NAMES,
        "industry_map": industry_map,
        "metrics": {"auc": round(auc, 4), "accuracy": round(acc, 4)},
        "n_samples": int(len(X)),
        "positives": int(y.sum()),
        "model_type": "GradientBoostingClassifier",
    }
    MODELS.mkdir(parents=True, exist_ok=True)
    out = MODELS / f"{name}.joblib"
    joblib.dump(bundle, out)
    print(f"  ✓ {name}: n={len(X)} pos={int(y.sum())} AUC={auc:.3f} acc={acc:.3f} -> {out}")
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
