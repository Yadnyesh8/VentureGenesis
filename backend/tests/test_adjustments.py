from app.agents.ml.failure_prediction import _financial_adjustment
from app.agents.ml.funding_readiness import _traction_adjustment

HEALTHY = {
    "runway": 18, "churn_rate": 0.02, "customer_growth": 0.15,
    "revenue": 2_000_000, "expenses": 1_500_000,
}
DISTRESSED = {
    "runway": 2, "churn_rate": 0.30, "customer_growth": -0.10,
    "revenue": 0, "expenses": 100_000,
}


def test_failure_adjustment_orders_healthy_below_distressed():
    d_healthy, _ = _financial_adjustment(HEALTHY)
    d_bad, _ = _financial_adjustment(DISTRESSED)
    assert d_bad > d_healthy
    assert d_healthy < 0  # healthy company earns the baseline credit
    assert -0.25 <= d_healthy <= 0.45
    assert -0.25 <= d_bad <= 0.45


def test_failure_adjustment_monotonic_in_runway():
    deltas = []
    for runway in (1, 3, 6, 12):
        d, _ = _financial_adjustment({**HEALTHY, "runway": runway})
        deltas.append(d)
    assert deltas == sorted(deltas, reverse=True)  # less runway -> more risk


def test_failure_adjustment_monotonic_in_churn():
    low, _ = _financial_adjustment({**HEALTHY, "churn_rate": 0.02})
    high, _ = _financial_adjustment({**HEALTHY, "churn_rate": 0.30})
    assert high > low


def test_burn_only_penalized_above_threshold():
    """A modestly unprofitable company (burn ratio < high_burn_ratio) gets no burn penalty."""
    _, contributions = _financial_adjustment({**HEALTHY, "revenue": 900_000, "expenses": 1_000_000})
    burn = next(c for c in contributions if c["feature"] == "burn_rate")
    assert burn["impact"] == 0.0

    _, contributions = _financial_adjustment({**HEALTHY, "revenue": 0, "expenses": 1_000_000})
    burn = next(c for c in contributions if c["feature"] == "burn_rate")
    assert burn["impact"] > 0.0


def test_traction_adjustment_bounds_and_ordering():
    d_healthy = _traction_adjustment(HEALTHY)
    d_bad = _traction_adjustment(DISTRESSED)
    assert d_healthy > d_bad
    assert -0.2 <= d_bad <= 0.3
    assert -0.2 <= d_healthy <= 0.3
