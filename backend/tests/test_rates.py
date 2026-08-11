"""The monthly-rate scale contract: customer_growth and churn_rate are 0-1 fractions.

The defect these cover: a founder typing 11.4 (meaning 11.4% MoM) had it read as
1140% by every consumer, which the revenue forecast clamped to +40%/month and
compounded over 30 months into a 17,000x chart and a $68M projection.
"""
from app.agents.ml.revenue_forecast import forecast_revenue
from app.db import models
from app.db.schemas import StartupBase, StartupRef
from app.utils.rates import RATE_FIELDS, normalize_rate, normalize_rates
from app.utils.resolve import resolve_metrics


class _StubDB:
    """Stands in for a Session so a row can be written without going through pydantic."""

    def __init__(self, row):
        self._row = row

    def get(self, _model, _pk):
        return self._row


def test_percent_scaled_input_is_divided_once():
    assert normalize_rate(11.4, "customer_growth") == 0.114
    assert normalize_rate(14, "customer_growth") == 0.14
    assert normalize_rate(-5, "customer_growth") == -0.05
    assert normalize_rate(3, "churn_rate") == 0.03


def test_fractional_input_is_left_alone():
    for v in (0.0, 0.14, 0.114, -0.05, 1.0):
        assert normalize_rate(v, "customer_growth") == v
    for v in (0.0, 0.03, 1.0):
        assert normalize_rate(v, "churn_rate") == v


def test_normalization_is_idempotent():
    """Applied at the schema boundary AND in resolve_metrics, so it must not double-divide."""
    for field in RATE_FIELDS:
        for v in (0, 0.14, 1, 1.5, 11.4, 14, -5, -0.05, 250, 1140):
            once = normalize_rate(v, field)
            assert normalize_rate(once, field) == once


def test_values_stay_inside_the_documented_domain():
    for field, (lo, hi) in RATE_FIELDS.items():
        for v in (-10_000, -1, 0, 1, 9_999):
            assert lo <= normalize_rate(v, field) <= hi
    assert normalize_rate(-3, "churn_rate") == 0.0  # negative churn is not a thing


def test_non_numeric_and_missing_are_not_guessed_at():
    assert normalize_rate(None, "churn_rate") is None
    assert normalize_rate("n/a", "churn_rate") == "n/a"
    assert normalize_rate(float("nan"), "churn_rate") == 0.0
    assert normalize_rates({"revenue": 1_000})["revenue"] == 1_000  # untouched


def test_schema_normalizes_inline_and_created_startups():
    s = StartupBase(startup_name="Acme", customer_growth=11.4, churn_rate=3)
    assert s.customer_growth == 0.114
    assert s.churn_rate == 0.03


def test_resolve_normalizes_rows_that_bypassed_the_schema():
    """CSV imports and pre-policy rows reach agents through resolve_metrics, not pydantic."""
    row = models.Startup(startup_name="Acme", customer_growth=11.4, churn_rate=3, burn_rate=1)
    m = resolve_metrics(StartupRef(startup_id=1), _StubDB(row))
    assert m["customer_growth"] == 0.114
    assert m["churn_rate"] == 0.03


def test_every_consumer_sees_the_same_growth_number():
    """The whole point: the forecast page must not disagree with health/failure/funding."""
    from app.agents.ml.causal import _node_activation
    from app.agents.ml.failure_prediction import _financial_adjustment
    from app.agents.ml.health import compute_health
    from app.simulation.digital_twin import build_state

    typed = StartupBase(
        startup_name="Acme", revenue=4_200_000, expenses=5_000_000, burn_rate=120_000,
        runway=8, customer_count=340, customer_growth=11.4, churn_rate=3,
    )
    stated = resolve_metrics(StartupRef(metrics=typed))
    canonical = resolve_metrics(
        StartupRef(metrics=StartupBase(**{**typed.model_dump(), "customer_growth": 0.114, "churn_rate": 0.03}))
    )

    assert stated["customer_growth"] == canonical["customer_growth"] == 0.114
    assert build_state(stated)["growth_rate"] == 0.114
    assert compute_health(stated) == compute_health(canonical)
    assert _financial_adjustment(stated) == _financial_adjustment(canonical)
    assert _node_activation(stated) == _node_activation(canonical)
    assert forecast_revenue(stated) == forecast_revenue(canonical)


def test_forecast_no_longer_compounds_a_percent_as_a_multiplier():
    m = resolve_metrics(StartupRef(metrics=StartupBase(
        startup_name="Acme", revenue=4_200_000, customer_growth=11.4,
    )))
    f = forecast_revenue(m)
    assert f["monthly_growth_rate"] == 0.114  # not the 0.4 clamp ceiling
    points = f["series"] + f["projection"]
    # Was ~17,000x across the plotted window on the same input.
    assert max(points) / min(points) < 50
    # $350K/month growing 11.4% MoM, not the $68.2M the raw value produced.
    assert 8_000_000 < f["forecast_12m"] < 11_000_000
