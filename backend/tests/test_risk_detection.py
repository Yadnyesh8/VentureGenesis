from app.agents.ml.risk_detection import detect_risks

HEALTHY = {
    "runway": 18, "churn_rate": 0.02, "customer_growth": 0.15,
    "revenue": 2_000_000, "expenses": 1_500_000, "valuation": 20_000_000,
    "employee_count": 25, "stage": "Series A", "founding_year": 2023,
    "customer_count": 500,
}
DISTRESSED = {
    "runway": 2, "churn_rate": 0.30, "customer_growth": -0.10,
    "revenue": 0, "expenses": 100_000, "valuation": 15_000_000,
    "employee_count": 1, "stage": "Seed", "founding_year": 2017,
    "customer_count": 0,
}


def test_healthy_startup_scores_low():
    r = detect_risks(HEALTHY)
    assert r["overall_risk_score"] < 25
    assert r["risk_level"] in ("low", "moderate")
    assert r["flag_count"] == 0


def test_distressed_startup_scores_high_with_expected_flags():
    r = detect_risks(DISTRESSED, failure_prob=0.75, funding_prob=0.15)
    assert r["overall_risk_score"] > 60
    assert r["risk_level"] in ("high", "critical")
    ids = {f["id"] for cat in r["categories"].values() for f in cat["flags"]}
    assert "runway_critical" in ids
    assert "churn_critical" in ids
    assert "shrinking_base" in ids
    assert "stage_stagnation" in ids
    assert "model_failure_signal" in ids
    assert "fundraising_risk" in ids


def test_leaky_bucket_detection():
    r = detect_risks({**HEALTHY, "customer_growth": 0.05, "churn_rate": 0.12})
    ids = {f["id"] for cat in r["categories"].values() for f in cat["flags"]}
    assert "leaky_bucket" in ids


def test_top_risks_sorted_by_severity():
    r = detect_risks(DISTRESSED, failure_prob=0.75, funding_prob=0.15)
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    ranks = [sev_rank[f["severity"]] for f in r["top_risks"]]
    assert ranks == sorted(ranks)
    assert len(r["top_risks"]) <= 5


def test_categories_always_present():
    r = detect_risks({})
    assert set(r["categories"]) == {"financial", "customer", "market", "team", "execution"}
    for cat in r["categories"].values():
        assert 0 <= cat["score"] <= 100
