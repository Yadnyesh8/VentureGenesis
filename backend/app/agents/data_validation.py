"""Data Validation Agent (Phase 3).

Detects nulls/missing, duplicates, and outliers via IQR + Z-score + Isolation Forest.
Isolation Forest is optional (sklearn); falls back to IQR/Z-score union if unavailable.
"""
from __future__ import annotations

import math
from typing import Any

import pandas as pd

from app.core.config import get_config

try:
    from sklearn.ensemble import IsolationForest  # type: ignore

    _HAS_SK = True
except Exception:  # pragma: no cover
    _HAS_SK = False


def _numeric_cols(df: pd.DataFrame) -> list[str]:
    return [
        c for c in df.columns
        if pd.api.types.is_numeric_dtype(df[c])
        and not pd.api.types.is_bool_dtype(df[c])
    ]


def _iqr_outliers(series: pd.Series, mult: float) -> int:
    q1, q3 = series.quantile(0.25), series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0 or math.isnan(iqr):
        return 0
    low, high = q1 - mult * iqr, q3 + mult * iqr
    return int(((series < low) | (series > high)).sum())


def _zscore_outliers(series: pd.Series, thresh: float) -> int:
    std = series.std()
    if std == 0 or math.isnan(std):
        return 0
    z = (series - series.mean()).abs() / std
    return int((z > thresh).sum())


def validate_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    cfg = get_config().get("outlier_detection", {})
    z_thresh = cfg.get("z_score_threshold", 3.0)
    iqr_mult = cfg.get("iqr_multiplier", 1.5)
    contamination = cfg.get("isolation_forest_contamination", 0.05)

    total_cells = max(df.size, 1)
    missing_by_col = df.isnull().sum()
    missing_fields = [c for c in df.columns if missing_by_col[c] > 0]
    total_missing = int(missing_by_col.sum())
    duplicates = int(df.duplicated().sum())

    num_cols = _numeric_cols(df)
    outliers_by_method: dict[str, int] = {"iqr": 0, "zscore": 0, "isolation_forest": 0}
    for c in num_cols:
        s = df[c].dropna()
        if len(s) < 4:
            continue
        outliers_by_method["iqr"] += _iqr_outliers(s, iqr_mult)
        outliers_by_method["zscore"] += _zscore_outliers(s, z_thresh)

    if _HAS_SK and num_cols and len(df) >= 8:
        try:
            sub = df[num_cols].fillna(df[num_cols].median())
            iso = IsolationForest(contamination=contamination, random_state=42)
            preds = iso.fit_predict(sub)
            outliers_by_method["isolation_forest"] = int((preds == -1).sum())
        except Exception:
            pass

    outliers_detected = max(outliers_by_method.values()) if outliers_by_method else 0

    # Data quality score: penalize missingness, duplicates, outliers.
    missing_ratio = total_missing / total_cells
    dup_ratio = duplicates / max(len(df), 1)
    outlier_ratio = outliers_detected / max(len(df), 1)
    score = 100.0 * (1 - missing_ratio) * (1 - dup_ratio) * (1 - min(outlier_ratio, 1.0))
    score = round(max(0.0, min(100.0, score)), 1)

    return {
        "data_quality_score": score,
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "missing_fields": missing_fields,
        "total_missing": total_missing,
        "duplicates": duplicates,
        "outliers_detected": outliers_detected,
        "outliers_by_method": outliers_by_method,
        "isolation_forest_available": _HAS_SK,
    }
