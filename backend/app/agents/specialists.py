"""Specialist Lenses — distinct quantitative inputs per board agent.

Each board/intelligence agent is NOT just "the same context with a different prompt": this
module computes a **role-specific quantitative lens** from the founder's own numbers, so the
Investor literally reasons over dilution/capital-efficiency math, the CFO over burn-multiple
and default-alive math, the Market analyst over TAM/share math, etc. The agent then argues
from numbers no other agent is looking at — genuine specialization, not prompt variation.

Pure, deterministic, transparent math (ML-agent fallback convention: never raises, always
returns). Optional tunables live in `config.json -> specialists`; sensible internal defaults
are used when the block is absent, so the lenses always run.
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config

# Maps the many role spellings used across the codebase to one canonical lens.
_ROLE_ALIAS = {
    "founder": "founder",
    "investor": "investor",
    "financial": "cfo",
    "financial_risk": "cfo",
    "cfo": "cfo",
    "customer": "customer",
    "market": "market",
    "competitor": "competitor",
}

# Internal defaults so the module runs even if config.json has no `specialists` block.
_DEFAULTS = {
    # Rough industry TAM priors (USD) for a transparent market-share estimate. These are
    # order-of-magnitude anchors, flagged as `prior` in the output — not a data feed.
    "industry_tam_usd": {
        "Fintech": 3.0e11, "Finances": 3.0e11, "Healthcare": 4.0e11, "Health": 4.0e11,
        "Education": 1.0e11, "B2B": 2.0e11, "Consumer": 2.5e11, "Industrials": 1.5e11,
        "default": 1.0e11,
    },
    # Typical total funding (USD) a peer at this stage has raised — competitor positioning.
    "stage_peer_funding_usd": {
        "idea": 1.0e5, "pre-seed": 5.0e5, "seed": 3.0e6, "early": 3.0e6,
        "series a": 1.5e7, "series b": 4.0e7, "growth": 1.0e8, "late": 2.0e8, "public": 5.0e8,
    },
    # Per-industry competitive density (0-1); higher = more crowded.
    "competitive_density": {
        "Fintech": 0.8, "Consumer": 0.85, "B2B": 0.6, "Healthcare": 0.55,
        "Education": 0.5, "default": 0.6,
    },
    # SAM is this fraction of TAM; SOM this fraction of SAM (serviceable/obtainable).
    "sam_fraction_of_tam": 0.15,
    "som_fraction_of_sam": 0.05,
    # Next-round sizing for the dilution estimate: raise enough to reach this runway.
    "target_runway_months": 18.0,
}


def _cfg() -> dict[str, Any]:
    """`specialists` config merged over internal defaults (per-key, shallow)."""
    block = get_config().get("specialists", {}) or {}
    merged = dict(_DEFAULTS)
    merged.update(block)
    return merged


def _num(metrics: dict[str, Any], key: str, default: float = 0.0) -> float:
    v = metrics.get(key, default)
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _round(x: float, n: int = 3) -> float:
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return 0.0


# ──────────────────────────── per-role lenses ────────────────────────────

def _investor_lens(m: dict[str, Any]) -> dict[str, Any]:
    """Dilution, capital efficiency, and valuation-multiple math."""
    cfg = _cfg()
    funding = _num(m, "funding_amount")
    valuation = _num(m, "valuation")
    revenue = _num(m, "revenue")
    growth = _num(m, "customer_growth")
    burn = _num(m, "burn_rate")
    runway = _num(m, "runway")

    # Capital efficiency: ARR generated per dollar ever raised (Bessemer-style).
    capital_efficiency = _round(revenue / funding, 3) if funding > 0 else None
    revenue_multiple = _round(valuation / revenue, 1) if revenue > 0 else None

    # Implied next-round dilution: size the round to reach a healthy runway at current burn,
    # then dilution = new_money / (pre_money + new_money), pre_money ≈ current valuation.
    target = cfg["target_runway_months"]
    round_size = max(0.0, burn * max(0.0, target - runway))
    post_money = valuation + round_size
    implied_dilution_pct = _round(100 * round_size / post_money, 1) if post_money > 0 else None

    return {
        "focus": "dilution, capital efficiency, valuation multiple",
        "capital_raised_usd": _round(funding, 0),
        "valuation_usd": _round(valuation, 0),
        "capital_efficiency_arr_per_$": capital_efficiency,
        "valuation_to_revenue_multiple": revenue_multiple,
        "implied_next_round_size_usd": _round(round_size, 0),
        "implied_dilution_pct": implied_dilution_pct,
        "yoy_growth_pct": _round(growth * 100, 1),
        "read": (
            "capital-efficient" if (capital_efficiency or 0) >= 0.5
            else "burning ahead of revenue" if funding > 0 else "pre-funding"
        ),
    }


def _cfo_lens(m: dict[str, Any]) -> dict[str, Any]:
    """Burn multiple, net burn, runway, and default-alive math."""
    revenue = _num(m, "revenue")
    expenses = _num(m, "expenses")
    burn = _num(m, "burn_rate")
    growth = _num(m, "customer_growth")
    runway = _num(m, "runway")
    cash = _num(m, "cash_reserves")

    net_burn_annual = expenses - revenue
    net_margin = _round((revenue - expenses) / revenue, 3) if revenue > 0 else None
    # Burn multiple = net cash burned / net new ARR added (Bessemer). <1 elite, >3 inefficient.
    net_new_arr = revenue * max(0.0, growth) * 12
    burn_multiple = _round((burn * 12) / net_new_arr, 2) if net_new_arr > 0 else None
    # Default-alive: profitable, or enough runway to reach plausible profitability (>=18mo).
    default_alive = (net_burn_annual <= 0) or (runway >= 18)

    return {
        "focus": "burn multiple, net burn, runway, default-alive",
        "monthly_burn_usd": _round(burn, 0),
        "net_burn_annual_usd": _round(net_burn_annual, 0),
        "net_margin": net_margin,
        "runway_months": _round(runway, 1),
        "cash_reserves_usd": _round(cash, 0),
        "burn_multiple": burn_multiple,
        "default_alive": default_alive,
        "read": (
            "profitable / default-alive" if default_alive and (net_burn_annual <= 0)
            else "funded but burning" if default_alive
            else "default-dead — runway-constrained"
        ),
    }


def _market_lens(m: dict[str, Any]) -> dict[str, Any]:
    """TAM/SAM/SOM and current-share math (industry priors, flagged as such)."""
    cfg = _cfg()
    industry = str(m.get("industry", "")).strip() or "default"
    revenue = _num(m, "revenue")
    growth = _num(m, "customer_growth")

    tam = cfg["industry_tam_usd"].get(industry, cfg["industry_tam_usd"]["default"])
    sam = tam * cfg["sam_fraction_of_tam"]
    som = sam * cfg["som_fraction_of_sam"]
    current_share_pct = _round(100 * revenue / sam, 4) if sam > 0 else None
    headroom_to_som = _round(som - revenue, 0)

    return {
        "focus": "TAM/SAM/SOM, current share, growth headroom",
        "industry": industry,
        "tam_usd": _round(tam, 0),
        "sam_usd": _round(sam, 0),
        "som_usd": _round(som, 0),
        "current_share_of_sam_pct": current_share_pct,
        "headroom_to_som_usd": headroom_to_som,
        "yoy_growth_pct": _round(growth * 100, 1),
        "basis": "industry prior (order-of-magnitude anchor, not a live data feed)",
    }


def _competitor_lens(m: dict[str, Any]) -> dict[str, Any]:
    """Funding position vs stage peers, moat proxy, and competitive density."""
    cfg = _cfg()
    industry = str(m.get("industry", "")).strip() or "default"
    stage = str(m.get("stage", "")).strip().lower()
    funding = _num(m, "funding_amount")
    customers = _num(m, "customer_count")
    valuation = _num(m, "valuation")

    peer_funding = cfg["stage_peer_funding_usd"].get(stage, 3.0e6)
    funding_ratio = _round(funding / peer_funding, 2) if peer_funding > 0 else None
    density = cfg["competitive_density"].get(industry, cfg["competitive_density"]["default"])
    # Crude moat proxy: installed base + capital, normalized.
    moat_proxy = _round(min(1.0, customers / 50000.0) * 0.6 + min(1.0, valuation / 1.0e8) * 0.4, 3)

    return {
        "focus": "funding position vs peers, moat, market crowding",
        "industry": industry,
        "stage": stage or "unknown",
        "funding_vs_stage_peer_x": funding_ratio,
        "funding_position": (
            "well-funded vs peers" if (funding_ratio or 0) >= 1.2
            else "underfunded vs peers" if (funding_ratio or 0) < 0.7 else "on par with peers"
        ),
        "competitive_density": density,
        "moat_proxy": moat_proxy,
    }


def _founder_lens(m: dict[str, Any]) -> dict[str, Any]:
    """Execution velocity: hiring pace, growth momentum, stagnation gap."""
    from app.ml_training.features import (
        age_from_founding_year, stage_to_code, _EXPECTED_AGE_AT_STAGE,
    )

    team = _num(m, "employee_count")
    growth = _num(m, "customer_growth")
    age = _num(m, "company_age_years") or age_from_founding_year(m.get("founding_year"))
    stage_code = stage_to_code(m.get("stage"))
    expected_age = _EXPECTED_AGE_AT_STAGE.get(stage_code, 3.0)

    hiring_velocity = _round(team / (age + 1.0), 2)
    age_stage_gap = _round(age - expected_age, 2)  # >0 means older than typical for the stage

    return {
        "focus": "hiring velocity, growth momentum, stage stagnation",
        "team_size": _round(team, 0),
        "company_age_years": _round(age, 1),
        "hiring_velocity_per_year": hiring_velocity,
        "yoy_growth_pct": _round(growth * 100, 1),
        "age_vs_stage_gap_years": age_stage_gap,
        "read": (
            "stalled for its stage" if age_stage_gap > 2 and growth < 0.05
            else "moving fast" if growth >= 0.1 else "steady"
        ),
    }


def _customer_lens(m: dict[str, Any]) -> dict[str, Any]:
    """Unit economics: ARPU, churn-implied lifetime, NRR proxy."""
    revenue = _num(m, "revenue")
    customers = _num(m, "customer_count")
    churn = _num(m, "churn_rate")
    growth = _num(m, "customer_growth")

    arpu_annual = _round(revenue / customers, 0) if customers > 0 else None
    lifetime_months = _round(1.0 / churn, 1) if churn > 0 else None  # None ⇒ no churn given
    # Lifetime value ≈ annual ARPU × lifetime in years.
    ltv = _round((arpu_annual or 0) * (lifetime_months / 12.0), 0) if (arpu_annual and lifetime_months) else None
    nrr_proxy = _round(1.0 + growth - churn, 3)  # >1 ⇒ net expansion

    return {
        "focus": "ARPU, churn-implied lifetime, net revenue retention",
        "customers": _round(customers, 0),
        "arpu_annual_usd": arpu_annual,
        "monthly_churn_pct": _round(churn * 100, 2),
        "churn_implied_lifetime_months": lifetime_months,
        "ltv_usd": ltv,
        "nrr_proxy": nrr_proxy,
        "read": (
            "expanding (NRR>1)" if nrr_proxy > 1.0
            else "leaking (NRR<1)" if nrr_proxy < 1.0 else "flat"
        ),
    }


_LENS_FN = {
    "founder": _founder_lens,
    "investor": _investor_lens,
    "cfo": _cfo_lens,
    "customer": _customer_lens,
    "market": _market_lens,
    "competitor": _competitor_lens,
}


def lens_for(role: str, metrics: dict[str, Any]) -> dict[str, Any]:
    """Compute the specialist quantitative lens for a given board role.

    Unknown roles get an empty lens (the agent simply argues from the shared context).
    """
    canonical = _ROLE_ALIAS.get(str(role).strip().lower())
    if canonical is None:
        return {}
    try:
        return _LENS_FN[canonical](metrics)
    except Exception:  # never let a lens break an agent (fallback convention)
        return {}


def all_lenses(metrics: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """All six specialist lenses keyed by canonical role (handy for the report/debug)."""
    return {role: fn(metrics) for role, fn in _LENS_FN.items()}


# ──────────────────────── deterministic decision functions ────────────────────────
# Each agent's STANCE is computed here in code from its specialist lens — it is NOT the
# LLM's choice. The LLM is downstream: it must argue the verdict the rules handed it (and
# justify any deviation against its own numbers). This is what makes a role a genuine agent
# with a decision function, not just a prompt to a model.

def _verdict_investor(L: dict[str, Any]) -> tuple[str, str, str]:
    eff = L.get("capital_efficiency_arr_per_$")
    dilution = L.get("implied_dilution_pct") or 0
    growth = L.get("yoy_growth_pct") or 0
    if dilution > 35 or (eff is not None and eff < 0.2):
        return "bearish", f"capital efficiency {eff} / dilution {dilution}% — burning ahead of value", "capital_efficiency_arr_per_$"
    if (eff is not None and eff >= 0.5) and growth > 0:
        return "bullish", f"capital-efficient ({eff} ARR per $) with {growth}% growth", "capital_efficiency_arr_per_$"
    return "neutral", "efficiency and dilution within normal band", "implied_dilution_pct"


def _verdict_cfo(L: dict[str, Any]) -> tuple[str, str, str]:
    if L.get("default_alive") is False:
        return "bearish", f"default-dead — {L.get('runway_months')}mo runway while burning", "default_alive"
    margin = L.get("net_margin")
    if L.get("default_alive") and (margin is None or margin >= 0):
        return "bullish", "default-alive (profitable or 18mo+ runway)", "default_alive"
    return "neutral", "funded but not yet self-sustaining", "net_margin"


def _verdict_market(L: dict[str, Any]) -> tuple[str, str, str]:
    growth = L.get("yoy_growth_pct") or 0
    share = L.get("current_share_of_sam_pct")
    if growth <= 0:
        return "bearish", f"flat/declining demand ({growth}% growth)", "yoy_growth_pct"
    if growth > 5 and (share is None or share < 1.0):
        return "bullish", f"{growth}% growth into a near-untapped SAM (share {share}%)", "current_share_of_sam_pct"
    return "neutral", "growing but with limited headroom signal", "yoy_growth_pct"


def _verdict_competitor(L: dict[str, Any]) -> tuple[str, str, str]:
    ratio = L.get("funding_vs_stage_peer_x") or 0
    density = L.get("competitive_density") or 0
    moat = L.get("moat_proxy") or 0
    if ratio < 0.7 and density >= 0.7:
        return "bearish", f"underfunded vs peers ({ratio}x) in a crowded market (density {density})", "funding_vs_stage_peer_x"
    if ratio >= 1.2 or moat >= 0.5:
        return "bullish", f"funding/moat edge (funding {ratio}x peers, moat {moat})", "moat_proxy"
    return "neutral", "competitively on par with stage peers", "funding_vs_stage_peer_x"


def _verdict_founder(L: dict[str, Any]) -> tuple[str, str, str]:
    growth = L.get("yoy_growth_pct") or 0
    gap = L.get("age_vs_stage_gap_years") or 0
    if gap > 2 and growth < 5:
        return "bearish", f"stalled for its stage ({gap}yr behind, {growth}% growth)", "age_vs_stage_gap_years"
    if growth >= 10:
        return "bullish", f"strong execution velocity ({growth}% growth)", "yoy_growth_pct"
    return "neutral", "steady execution, no stagnation signal", "age_vs_stage_gap_years"


def _verdict_customer(L: dict[str, Any]) -> tuple[str, str, str]:
    nrr = L.get("nrr_proxy")
    if nrr is None:
        return "neutral", "insufficient retention data", "nrr_proxy"
    if nrr > 1.0:
        return "bullish", f"net expansion (NRR proxy {nrr})", "nrr_proxy"
    if nrr < 1.0:
        return "bearish", f"net leakage (NRR proxy {nrr})", "nrr_proxy"
    return "neutral", "flat retention (NRR proxy 1.0)", "nrr_proxy"


_VERDICT_FN = {
    "founder": _verdict_founder,
    "investor": _verdict_investor,
    "cfo": _verdict_cfo,
    "customer": _verdict_customer,
    "market": _verdict_market,
    "competitor": _verdict_competitor,
}


def verdict_for(role: str, metrics: dict[str, Any]) -> dict[str, Any]:
    """Compute an agent's stance deterministically from its specialist lens.

    Returns {stance, rationale, trigger}. The stance is decided in code (not by the LLM);
    the LLM downstream must argue it. Unknown roles get a neutral verdict.
    """
    canonical = _ROLE_ALIAS.get(str(role).strip().lower())
    if canonical is None or canonical not in _VERDICT_FN:
        return {"stance": "neutral", "rationale": "no decision function for this role", "trigger": None}
    try:
        L = _LENS_FN[canonical](metrics)
        stance, rationale, trigger = _VERDICT_FN[canonical](L)
        return {"stance": stance, "rationale": rationale, "trigger": trigger}
    except Exception:  # never let the decision function break an agent
        return {"stance": "neutral", "rationale": "decision function unavailable", "trigger": None}


def metrics_consensus(metrics: dict[str, Any]) -> dict[str, Any]:
    """Code-only board stance: tally the six deterministic verdicts (no LLM involved)."""
    verdicts = {role: verdict_for(role, metrics) for role in
                ("Founder", "Investor", "Financial", "Customer", "Market", "Competitor")}
    tally: dict[str, int] = {"bullish": 0, "neutral": 0, "bearish": 0}
    for v in verdicts.values():
        tally[v["stance"]] = tally.get(v["stance"], 0) + 1
    consensus = max(tally, key=tally.get)
    return {"consensus": consensus, "tally": tally, "verdicts": verdicts}
