"""End-to-end tests against the trained bundles (skipped if models aren't trained)."""
import pytest

from app.ml_training import loader

HEALTHY = {
    "runway": 18, "churn_rate": 0.02, "customer_growth": 0.15,
    "revenue": 2_000_000, "expenses": 1_500_000, "valuation": 20_000_000,
    "employee_count": 25, "stage": "Series A", "founding_year": 2023,
    "industry": "Fintech",
}

needs_models = pytest.mark.skipif(
    not (loader.is_trained("failure_model") and loader.is_trained("funding_model")),
    reason="trained model bundles missing — run python -m app.ml_training.train",
)


@needs_models
def test_failure_prediction_outputs_valid_probabilities():
    from app.agents.ml.failure_prediction import predict_failure

    r = predict_failure(HEALTHY)
    for k in ("failure_6m", "failure_12m", "failure_24m"):
        assert 0.0 < r[k] < 1.0
    # Cumulative failure probability is non-decreasing with the horizon: a longer
    # window can only add risk (6m <= 12m <= 24m).
    assert r["failure_6m"] <= r["failure_12m"] <= r["failure_24m"]
    assert r["trained"] is True
    assert len(r["feature_importance"]) > 0


@needs_models
def test_failure_risk_increases_when_runway_collapses():
    from app.agents.ml.failure_prediction import predict_failure

    good = predict_failure(HEALTHY)
    bad = predict_failure({**HEALTHY, "runway": 1, "churn_rate": 0.3, "customer_growth": -0.1})
    assert bad["failure_12m"] > good["failure_12m"]


@needs_models
def test_funding_prediction_outputs_valid_probabilities():
    from app.agents.ml.funding_readiness import predict_funding

    r = predict_funding(HEALTHY)
    assert 0.0 < r["funding_probability"] < 1.0
    assert r["investor_score"] == round(r["funding_probability"] * 100, 1)


@needs_models
def test_funding_probability_rewards_traction():
    from app.agents.ml.funding_readiness import predict_funding

    good = predict_funding(HEALTHY)
    bad = predict_funding({**HEALTHY, "runway": 2, "customer_growth": 0.0, "revenue": 0})
    assert good["funding_probability"] > bad["funding_probability"]


@needs_models
def test_bundle_metrics_are_recorded():
    for name in ("failure_model", "funding_model"):
        b = loader.load_bundle(name)
        m = b["metrics"]
        assert m["auc"] > 0.7, f"{name} AUC regressed below 0.7"
        assert "cv_auc_mean" in m and "brier" in m and "pr_auc" in m


def test_health_score_bounds_and_grades():
    from app.agents.ml.health import compute_health

    r = compute_health(HEALTHY, funding_prob=0.8)
    assert 0 <= r["health_score"] <= 100
    assert r["grade"] in "ABCDF"
    worse = compute_health({**HEALTHY, "revenue": 0, "customer_growth": -0.2, "churn_rate": 0.4}, funding_prob=0.1)
    assert worse["health_score"] < r["health_score"]
