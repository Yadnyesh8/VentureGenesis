"""Shared feature engineering for training AND inference (must stay identical).

Features are limited to what a founder can answer in the onboarding questionnaire:
  - team_size        (employee count)
  - company_age_years
  - industry_code    (ordinal, via a mapping learned at train time)
  - stage_code       (0 = Early, 1 = Growth)

No synthetic/random data is used — these come from the real YC/Failory datasets at
train time and from the user's questionnaire at inference time.
"""
from __future__ import annotations

import datetime as _dt
from typing import Any

FEATURE_NAMES = ["team_size", "company_age_years", "industry_code", "stage_code"]

# Stages that indicate a later-stage ("Growth") company.
_GROWTH_STAGES = {"growth", "series b", "series c", "late", "public", "series d"}


def stage_to_code(stage: Any) -> int:
    if not stage:
        return 0
    return 1 if str(stage).strip().lower() in _GROWTH_STAGES else 0


def _age_from_unix(ts: Any) -> float:
    try:
        launched = _dt.datetime.utcfromtimestamp(float(ts))
        years = (_dt.datetime.utcnow() - launched).days / 365.25
        return max(0.0, round(years, 2))
    except Exception:
        return 0.0


def age_from_founding_year(year: Any) -> float:
    try:
        y = int(year)
        if y < 1900 or y > _dt.datetime.utcnow().year:
            return 0.0
        return max(0.0, _dt.datetime.utcnow().year - y)
    except Exception:
        return 0.0


def row_to_features_training(row, industry_map: dict[str, int]) -> list[float]:
    """Build a feature vector from a raw dataset row (training time)."""
    team = row.get("team_size")
    team = float(team) if team is not None and str(team) != "nan" else 0.0
    age = _age_from_unix(row.get("launched_at"))
    industry = str(row.get("industry", "")).strip()
    ind_code = industry_map.get(industry, -1)
    stage_code = stage_to_code(row.get("stage"))
    return [team, age, float(ind_code), float(stage_code)]


def metrics_to_features(metrics: dict[str, Any], industry_map: dict[str, int]) -> list[float]:
    """Build a feature vector from questionnaire metrics (inference time)."""
    team = float(metrics.get("employee_count", 0) or 0)
    # Prefer explicit company_age_years, else derive from founding_year, else 0.
    age = metrics.get("company_age_years")
    if age is None:
        age = age_from_founding_year(metrics.get("founding_year"))
    industry = str(metrics.get("industry", "")).strip()
    ind_code = industry_map.get(industry, -1)
    stage_code = stage_to_code(metrics.get("stage"))
    return [float(team), float(age), float(ind_code), float(stage_code)]
