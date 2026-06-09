"""Shared feature engineering for training AND inference (must stay identical).

Features are limited to what a founder can answer in the onboarding questionnaire:
  - team_size          (employee count)
  - company_age_years
  - industry_code      (ordinal id; target-encoded inside the model pipeline)
  - stage_code         (ordinal funding-stage ladder, 0=Idea .. 8=Public, -1 unknown)
  - age_stage_gap      (years older than typical for the declared stage -> stagnation)
  - team_per_year      (hiring velocity proxy: team size per year of life)

No synthetic/random data is used — these come from the real YC/Failory datasets at
train time and from the user's questionnaire at inference time.
"""
from __future__ import annotations

import datetime as _dt
from typing import Any

FEATURE_NAMES = [
    "team_size",
    "company_age_years",
    "industry_code",
    "stage_code",
    "age_stage_gap",
    "team_per_year",
]

# Index of the categorical industry column (target-encoded in the model pipeline).
INDUSTRY_COL_INDEX = FEATURE_NAMES.index("industry_code")

# Ordinal funding-stage ladder. Dataset rows only contain {Early, Growth}; the
# questionnaire offers the full ladder, which tree models interpolate between.
_STAGE_ORDINAL = {
    "idea": 0,
    "pre-seed": 1,
    "preseed": 1,
    "seed": 2,
    "early": 3,
    "series a": 4,
    "series b": 5,
    "growth": 6,
    "series c": 7,
    "series d": 7,
    "late": 7,
    "public": 8,
}

# Typical company age (years) at each stage ordinal — used for the stagnation signal.
_EXPECTED_AGE_AT_STAGE = {0: 0.0, 1: 0.5, 2: 1.0, 3: 2.0, 4: 3.0, 5: 5.0, 6: 6.0, 7: 8.0, 8: 10.0}


def stage_to_code(stage: Any) -> int:
    """Ordinal stage code; -1 when unknown/missing so trees can isolate missingness."""
    if not stage:
        return -1
    return _STAGE_ORDINAL.get(str(stage).strip().lower(), -1)


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


def _derive(team: float, age: float, ind_code: float, stage_code: int) -> list[float]:
    expected_age = _EXPECTED_AGE_AT_STAGE.get(stage_code, 3.0)
    age_stage_gap = age - expected_age
    team_per_year = team / (age + 1.0)
    return [team, age, float(ind_code), float(stage_code), round(age_stage_gap, 2), round(team_per_year, 2)]


def row_to_features_training(row, industry_map: dict[str, int]) -> list[float]:
    """Build a feature vector from a raw dataset row (training time)."""
    team = row.get("team_size")
    team = float(team) if team is not None and str(team) != "nan" else 0.0
    age = _age_from_unix(row.get("launched_at"))
    industry = str(row.get("industry", "")).strip()
    ind_code = industry_map.get(industry, -1)
    stage_code = stage_to_code(row.get("stage"))
    return _derive(team, age, ind_code, stage_code)


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
    return _derive(float(team), float(age), float(ind_code), stage_code)
