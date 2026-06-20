"""Frontier-agent deterministic-engine tests (Features 1-4).

These cover the pure, config-driven layers (no LLM, no trained model required), so they run
on the minimal install. The LLM narrative wrappers are intentionally not tested here — they
make live calls and raise on failure by design.
"""
from app.agents.ml import agi_exposure, causal, spinout, voi
from app.core import knowledge

STRUGGLING = {
    "industry": "Analytics", "business_model": "SaaS", "stage": "Seed",
    "revenue": 200_000, "expenses": 900_000, "burn_rate": 70_000, "runway": 4,
    "customer_count": 1200, "customer_growth": -0.05, "churn_rate": 0.22,
    "funding_amount": 1_500_000, "valuation": 8_000_000,
}
HEALTHY = {
    "industry": "Fintech", "business_model": "B2B", "stage": "Series A",
    "revenue": 4_000_000, "expenses": 3_000_000, "burn_rate": 50_000, "runway": 24,
    "customer_count": 80_000, "customer_growth": 0.18, "churn_rate": 0.03,
    "funding_amount": 1.0e8, "valuation": 5.0e8,
}


# ---- Causal Trajectory ----

def test_causal_detects_death_path_for_struggling():
    t = causal.map_trajectory(STRUGGLING)
    assert 0 < t["death_probability"] <= 1
    assert t["root_cause"] is not None
    assert t["chain"] and t["interventions"]
    # the chain must terminate at the death node via the edges
    assert any("death" in (e.get("to", "")) for e in t["chain"] if "to" in e)


def test_causal_stable_when_kpis_healthy():
    t = causal.map_trajectory(HEALTHY)
    assert t["death_probability"] == 0.0
    assert t["chain"] == []


# ---- AGI Pre-Conditioner ----

def test_agi_resistance_in_range_and_curve_monotonic():
    a = agi_exposure.assess(STRUGGLING)
    assert 0 <= a["resistance_score"] <= 1
    vals = [c["surviving_value"] for c in a["survival_curve"]]
    assert vals == sorted(vals, reverse=True)  # survival can only erode as AGI advances


def test_agi_stronger_moats_raise_resistance():
    weak = agi_exposure.assess(STRUGGLING)
    strong = agi_exposure.assess(STRUGGLING, moats={"data_moat": 1.0, "distribution": 1.0,
                                                    "capital_moat": 1.0, "labor_arbitrage": 1.0})
    assert strong["resistance_score"] > weak["resistance_score"]


# ---- Spin-out Viability ----

def test_spinout_recommends_spinout_for_disruptive_misfit():
    proj = {"market_disruption": 0.9, "cannibalization_risk": 0.2, "capital_intensity": 0.3,
            "talent_flight_risk": 0.8, "strategic_adjacency": 0.2}
    r = spinout.assess(proj)
    assert r["recommendation"] == "SPIN_OUT"
    assert r["ev_spinout"] > r["ev_internal"]


def test_spinout_recommends_internal_for_adjacent_cannibalizing():
    proj = {"market_disruption": 0.1, "cannibalization_risk": 0.9, "capital_intensity": 0.8,
            "talent_flight_risk": 0.2, "strategic_adjacency": 0.95}
    r = spinout.assess(proj)
    assert r["recommendation"] == "KEEP_INTERNAL"
    assert r["ev_internal"] > r["ev_spinout"]


# ---- Value of Information ----

def test_voi_ranks_gaps_and_respects_budget_keyless():
    knowledge.reset_run()
    r = voi.assess(STRUGGLING, allow_fetch=True)
    assert r["ledger"], "should surface information gaps"
    # ledger sorted by VOI descending
    vois = [it["voi"] for it in r["ledger"]]
    assert vois == sorted(vois, reverse=True)
    # keyless: external paid sources are unavailable, so no real $ is spent
    assert r["spend"]["usd_spent"] == 0.0
    # never exceeds the configured fetch budget
    from app.core.config import get_config
    assert r["fetches_made"] <= get_config()["voi"]["max_fetches_per_run"]


def test_voi_causal_leverage_boosts_value():
    # Zero out runway so it registers as an information gap, then confirm the causal
    # cross-link amplifies its VOI (a fatal-path unknown is worth more to resolve).
    m = {**STRUGGLING, "runway": 0}
    base = voi.assess(m, allow_fetch=False)
    boosted = voi.assess(m, allow_fetch=False, causal_leverage={"runway": 1.0})
    b0 = {it["field"]: it["voi"] for it in base["ledger"]}
    b1 = {it["field"]: it["voi"] for it in boosted["ledger"]}
    assert "runway" in b0 and "runway" in b1
    assert b1["runway"] > b0["runway"]
