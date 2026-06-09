from app.ml_training.features import (
    FEATURE_NAMES,
    INDUSTRY_COL_INDEX,
    metrics_to_features,
    row_to_features_training,
    stage_to_code,
)

IND_MAP = {"Fintech": 0, "Healthcare": 1}


def test_stage_ordering_is_monotonic():
    order = ["Idea", "Pre-Seed", "Seed", "Early", "Series A", "Series B", "Growth", "Late"]
    codes = [stage_to_code(s) for s in order]
    assert codes == sorted(codes)
    assert stage_to_code(None) == -1
    assert stage_to_code("totally unknown") == -1


def test_metrics_to_features_shape_and_values():
    m = {"employee_count": 10, "founding_year": 2022, "industry": "Fintech", "stage": "Seed"}
    feats = metrics_to_features(m, IND_MAP)
    assert len(feats) == len(FEATURE_NAMES)
    assert feats[0] == 10.0
    assert feats[INDUSTRY_COL_INDEX] == 0.0
    # team_per_year = team / (age + 1)
    age = feats[1]
    assert abs(feats[-1] - 10.0 / (age + 1)) < 0.01


def test_unknown_industry_maps_to_minus_one():
    feats = metrics_to_features({"industry": "Quantum Llamas"}, IND_MAP)
    assert feats[INDUSTRY_COL_INDEX] == -1.0


def test_training_and_inference_features_align():
    """Same company described via dataset row vs questionnaire must featurize identically."""
    import datetime as dt

    year = dt.datetime.utcnow().year - 3
    launched = dt.datetime(year, dt.datetime.utcnow().month, 15).timestamp()
    row = {"team_size": 7, "launched_at": launched, "industry": "Healthcare", "stage": "Early"}
    metrics = {"employee_count": 7, "founding_year": year, "industry": "Healthcare", "stage": "Early"}
    f_train = row_to_features_training(row, IND_MAP)
    f_infer = metrics_to_features(metrics, IND_MAP)
    assert f_train[0] == f_infer[0]
    assert abs(f_train[1] - f_infer[1]) <= 1.0  # age within a year (different derivations)
    assert f_train[2:4] == f_infer[2:4]


def test_stagnation_signal():
    """An old company stuck at Seed must show a larger age_stage_gap than a young one."""
    old = metrics_to_features({"employee_count": 3, "founding_year": 2015, "stage": "Seed"}, IND_MAP)
    young = metrics_to_features({"employee_count": 3, "founding_year": 2025, "stage": "Seed"}, IND_MAP)
    gap_idx = FEATURE_NAMES.index("age_stage_gap")
    assert old[gap_idx] > young[gap_idx]
