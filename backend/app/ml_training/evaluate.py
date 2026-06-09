"""Offline evaluation harness for the trained model bundles.

Prints, for each model:
  - the honest metrics saved at train time (holdout + cross-validated)
  - permutation feature importances
  - a calibration (reliability) table on the full dataset so you can see whether
    predicted probabilities match observed outcome rates per decile

Run:  python -m app.ml_training.evaluate
"""
from __future__ import annotations

import numpy as np

from app.ml_training import loader
from app.ml_training.train import _load_dataset, _featurize


def _calibration_table(y: np.ndarray, proba: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.quantile(proba, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = 0.0, 1.0
    rows = []
    for i in range(bins):
        mask = (proba >= edges[i]) & (proba <= edges[i + 1] if i == bins - 1 else proba < edges[i + 1])
        if mask.sum() == 0:
            continue
        rows.append({
            "bucket": f"{edges[i]:.2f}-{edges[i + 1]:.2f}",
            "n": int(mask.sum()),
            "mean_predicted": round(float(proba[mask].mean()), 3),
            "observed_rate": round(float(y[mask].mean()), 3),
        })
    return rows


def main():
    df = _load_dataset()
    status = df["status"].astype(str).str.strip().str.lower()
    top = df.get("top_company")
    top_bool = top.astype(str).str.lower().eq("true").to_numpy() if top is not None else np.zeros(len(df), bool)
    targets = {
        "failure_model": (status == "inactive").astype(int).to_numpy(),
        "funding_model": (status.isin(["acquired", "public"]).to_numpy() | top_bool).astype(int),
    }

    for name, y in targets.items():
        bundle = loader.load_bundle(name)
        if bundle is None:
            print(f"✗ {name}: not trained")
            continue
        print(f"\n=== {name} ({bundle['model_type']}) ===")
        print(f"  samples={bundle['n_samples']} positives={bundle['positives']}")
        print(f"  best_params={bundle.get('best_params')}")
        for k, v in bundle["metrics"].items():
            print(f"  {k:>18}: {v}")
        if bundle.get("feature_importances"):
            print("  permutation importances (holdout AUC drop):")
            for f, imp in sorted(bundle["feature_importances"].items(), key=lambda t: -t[1]):
                print(f"    {f:>20}: {imp:+.4f}")

        X = _featurize(df, bundle["industry_map"])
        proba = bundle["model"].predict_proba(X)[:, 1]
        print("  calibration (full dataset, in-sample — trend check only):")
        for row in _calibration_table(y, proba):
            print(f"    {row['bucket']:>11}  n={row['n']:<5} pred={row['mean_predicted']:.3f} observed={row['observed_rate']:.3f}")


if __name__ == "__main__":
    main()
