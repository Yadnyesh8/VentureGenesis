"""Specialist lenses + model confidence (deterministic — run on the minimal install).

These cover the two upgrades that make the agents genuinely specialized rather than
"the same context with a different prompt": each agent gets distinct quantitative inputs,
and every trained prediction carries a transparent confidence score.
"""
from app.agents import specialists
from app.agents.ml.confidence import model_confidence, input_completeness

FULL = {
    "industry": "Fintech", "stage": "Seed",
    "funding_amount": 3_000_000, "valuation": 20_000_000,
    "revenue": 1_200_000, "expenses": 1_800_000,
    "burn_rate": 120_000, "cash_reserves": 720_000, "runway": 6,
    "customer_count": 340, "customer_growth": 0.14, "churn_rate": 0.03,
    "employee_count": 12, "founding_year": 2023,
}


def test_each_role_gets_a_distinct_lens():
    lenses = {r: specialists.lens_for(r, FULL) for r in
              ("Founder", "Investor", "Financial", "Customer", "Market", "Competitor")}
    # Every role produces a non-empty lens with its own focus...
    focuses = {r: l["focus"] for r, l in lenses.items()}
    assert all(focuses.values())
    # ...and the focuses are all different (genuine specialization, not one shared view).
    assert len(set(focuses.values())) == len(focuses)
    # The investor's lens keys must NOT equal the CFO's — they look at different numbers.
    assert set(lenses["Investor"]) != set(lenses["Financial"])


def test_investor_lens_computes_dilution_and_efficiency():
    inv = specialists.lens_for("Investor", FULL)
    # capital efficiency = revenue / funding = 1.2M / 3.0M = 0.4
    assert inv["capital_efficiency_arr_per_$"] == 0.4
    # valuation/revenue multiple = 20M / 1.2M ≈ 16.7
    assert 16 < inv["valuation_to_revenue_multiple"] < 17
    # raising to extend 6mo→18mo runway at 120k/mo ⇒ a real, positive dilution figure
    assert inv["implied_dilution_pct"] and inv["implied_dilution_pct"] > 0


def test_cfo_lens_flags_default_dead_when_runway_short():
    cfo = specialists.lens_for("Financial", FULL)
    assert cfo["net_burn_annual_usd"] == 600_000      # expenses 1.8M − revenue 1.2M
    assert cfo["default_alive"] is False              # 6mo runway, burning
    alive = specialists.lens_for("Financial", {**FULL, "runway": 24})
    assert alive["default_alive"] is True


def test_customer_lens_unit_economics():
    cx = specialists.lens_for("Customer", FULL)
    assert cx["churn_implied_lifetime_months"] == round(1 / 0.03, 1)
    assert cx["nrr_proxy"] == round(1 + 0.14 - 0.03, 3)  # net expansion


def test_unknown_role_returns_empty_lens():
    assert specialists.lens_for("Chairperson", FULL) == {}


def test_confidence_rises_with_input_completeness():
    bundle_metrics = {"auc": 0.84, "brier": 0.18, "cv_auc_std": 0.02}
    full = model_confidence(FULL, bundle_metrics)["model_confidence"]
    sparse = model_confidence(
        {"industry": "Fintech", "stage": "Seed", "employee_count": 3}, bundle_metrics
    )["model_confidence"]
    assert 0 <= sparse < full <= 98


def test_confidence_is_bounded_and_neutral_without_metrics():
    out = model_confidence(FULL, None)
    assert 30 <= out["model_confidence"] <= 98
    assert set(out["components"]) == {
        "discrimination", "calibration", "stability", "input_completeness"
    }


def test_input_completeness_fraction():
    assert input_completeness({}, ["a", "b"]) == 0.0
    assert input_completeness({"a": 1, "b": 2}, ["a", "b"]) == 1.0
    assert input_completeness({"a": 1, "b": 0}, ["a", "b"]) == 0.5


# ── deterministic decision functions: stance is decided in code, not by the LLM ──

def test_verdict_is_computed_per_role_and_roles_can_disagree():
    verdicts = {r: specialists.verdict_for(r, FULL)["stance"] for r in
                ("Founder", "Investor", "Financial", "Customer", "Market", "Competitor")}
    assert all(v in ("bullish", "neutral", "bearish") for v in verdicts.values())
    # The CFO (6mo runway, burning) must disagree with the Customer (NRR>1) — genuine,
    # code-driven disagreement, not one model's mood.
    assert verdicts["Financial"] == "bearish"
    assert verdicts["Customer"] == "bullish"


def test_cfo_verdict_flips_with_runway():
    assert specialists.verdict_for("Financial", FULL)["stance"] == "bearish"
    # 24mo runway makes it default-alive → off "bearish" (still unprofitable ⇒ neutral)…
    assert specialists.verdict_for("Financial", {**FULL, "runway": 24})["stance"] == "neutral"
    # …and default-alive AND profitable ⇒ bullish.
    profitable = {**FULL, "runway": 24, "revenue": 2_500_000, "expenses": 1_800_000}
    assert specialists.verdict_for("Financial", profitable)["stance"] == "bullish"


def test_customer_verdict_tracks_nrr():
    leaking = {**FULL, "customer_growth": 0.01, "churn_rate": 0.10}  # NRR proxy < 1
    assert specialists.verdict_for("Customer", leaking)["stance"] == "bearish"


def test_metrics_consensus_is_llm_free_and_shifts_with_health():
    weak = specialists.metrics_consensus(FULL)
    strong = specialists.metrics_consensus({
        **FULL, "runway": 24, "revenue": 5_000_000, "expenses": 3_000_000,
        "customer_growth": 0.25, "churn_rate": 0.01,
    })
    assert sum(weak["tally"].values()) == 6 and sum(strong["tally"].values()) == 6
    assert strong["tally"]["bullish"] > weak["tally"]["bullish"]


def test_unknown_role_verdict_is_neutral():
    assert specialists.verdict_for("Chairperson", FULL)["stance"] == "neutral"
