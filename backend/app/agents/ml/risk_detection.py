"""Risk Detection Agent — deterministic, multi-category startup risk engine.

Scans the founder's real questionnaire numbers (plus optional trained-model outputs)
and produces an auditable risk register:

  - 5 categories: financial, customer, market, team, execution
  - each category emits concrete flags with severity + evidence
  - category scores roll up into a weighted overall risk score (0-100)

All thresholds and weights live in config.json -> "failure_thresholds" /
"risk_detection", so risk policy can be tuned live without a deploy.
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config
from app.ml_training.features import stage_to_code

_SEVERITY_SCORE = {"low": 25, "medium": 50, "high": 75, "critical": 95}

_LEVELS = [(20, "low"), (40, "moderate"), (60, "elevated"), (80, "high"), (101, "critical")]


def _flag(fid: str, severity: str, message: str, evidence: dict[str, Any]) -> dict[str, Any]:
    return {"id": fid, "severity": severity, "message": message, "evidence": evidence}


def _category_score(flags: list[dict[str, Any]]) -> float:
    if not flags:
        return 5.0  # residual risk — nothing detected, not "no risk"
    sevs = sorted((_SEVERITY_SCORE[f["severity"]] for f in flags), reverse=True)
    return float(min(100.0, sevs[0] + 8.0 * (len(sevs) - 1)))


def _level_for(score: float) -> str:
    for cutoff, label in _LEVELS:
        if score < cutoff:
            return label
    return "critical"


def _financial_flags(m: dict[str, Any], thr: dict[str, Any]) -> list[dict[str, Any]]:
    flags = []
    runway = m.get("runway", 0) or 0
    revenue = m.get("revenue", 0) or 0
    expenses = m.get("expenses", 0) or 0
    burn_ratio = (expenses - revenue) / (expenses + 1)

    if runway <= 3:
        flags.append(_flag("runway_critical", "critical",
                           f"Runway of {runway:.1f} months — immediate survival risk",
                           {"runway_months": runway}))
    elif runway < thr["critical_runway_months"]:
        flags.append(_flag("runway_low", "high",
                           f"Runway of {runway:.1f} months is below the {thr['critical_runway_months']}-month critical line",
                           {"runway_months": runway}))
    elif runway < thr.get("warning_runway_months", 9):
        flags.append(_flag("runway_warning", "medium",
                           f"Runway of {runway:.1f} months leaves little margin to fundraise",
                           {"runway_months": runway}))

    if revenue > 0 and burn_ratio > thr["high_burn_ratio"]:
        flags.append(_flag("burn_high", "high",
                           f"Expenses exceed revenue by {burn_ratio:.0%} of spend — burn multiple is unsustainable",
                           {"burn_ratio": round(burn_ratio, 3), "revenue": revenue, "expenses": expenses}))
    elif revenue == 0 and expenses > 0:
        flags.append(_flag("pre_revenue_burn", "medium",
                           "Pre-revenue with active burn — fully dependent on external capital",
                           {"expenses": expenses}))
    return flags


def _customer_flags(m: dict[str, Any], thr: dict[str, Any]) -> list[dict[str, Any]]:
    flags = []
    churn = m.get("churn_rate", 0) or 0
    growth = m.get("customer_growth", 0) or 0

    if churn >= thr.get("critical_churn_rate", 0.25):
        flags.append(_flag("churn_critical", "critical",
                           f"Churn of {churn:.0%}/mo — the product is not retaining customers",
                           {"churn_rate": churn}))
    elif churn >= thr["high_churn_rate"]:
        flags.append(_flag("churn_high", "high",
                           f"Churn of {churn:.0%}/mo exceeds the {thr['high_churn_rate']:.0%} risk line",
                           {"churn_rate": churn}))

    if growth < 0:
        flags.append(_flag("shrinking_base", "high",
                           f"Customer base shrinking at {abs(growth):.0%}/mo",
                           {"customer_growth": growth}))
    elif 0 < growth < churn:
        flags.append(_flag("leaky_bucket", "medium",
                           f"Churn ({churn:.0%}) outpaces growth ({growth:.0%}) — net retention is negative",
                           {"churn_rate": churn, "customer_growth": growth}))
    return flags


def _market_flags(m: dict[str, Any], rd: dict[str, Any]) -> list[dict[str, Any]]:
    flags = []
    revenue = m.get("revenue", 0) or 0
    valuation = m.get("valuation", 0) or 0
    multiple_max = rd.get("valuation_revenue_multiple_max", 100)

    if revenue > 0 and valuation > multiple_max * revenue:
        flags.append(_flag("valuation_stretched", "medium",
                           f"Valuation is {valuation / revenue:.0f}x revenue (>{multiple_max}x) — markdown risk at next round",
                           {"valuation": valuation, "revenue": revenue}))
    elif revenue == 0 and valuation > 10_000_000:
        flags.append(_flag("valuation_unproven", "medium",
                           "Eight-figure valuation with zero revenue rests entirely on narrative",
                           {"valuation": valuation}))
    return flags


def _team_flags(m: dict[str, Any], rd: dict[str, Any]) -> list[dict[str, Any]]:
    flags = []
    team = m.get("employee_count", 0) or 0
    stage = stage_to_code(m.get("stage"))
    min_team = rd.get("min_team_for_growth_stage", 5)

    if stage >= 4 and team < min_team:
        flags.append(_flag("team_small_for_stage", "medium",
                           f"Team of {int(team)} is thin for a {m.get('stage')} company — execution bottleneck",
                           {"employee_count": team, "stage": m.get("stage")}))
    elif stage >= 2 and team <= 1:
        flags.append(_flag("solo_operation", "medium",
                           "Single-person operation at a funded stage — key-person risk",
                           {"employee_count": team, "stage": m.get("stage")}))
    return flags


def _execution_flags(m: dict[str, Any], rd: dict[str, Any],
                     failure_prob: float | None, funding_prob: float | None) -> list[dict[str, Any]]:
    flags = []
    from app.ml_training.features import age_from_founding_year

    age = m.get("company_age_years")
    if age is None:
        age = age_from_founding_year(m.get("founding_year"))
    stage = stage_to_code(m.get("stage"))
    customers = m.get("customer_count", 0) or 0

    # Stagnation: old company still at an early stage.
    expected = {0: 0, 1: 0.5, 2: 1, 3: 2, 4: 3, 5: 5, 6: 6, 7: 8, 8: 10}.get(stage, 3)
    if age - expected > rd.get("stagnation_years", 4):
        flags.append(_flag("stage_stagnation", "high",
                           f"{age:.0f} years old but still at {m.get('stage') or 'an early stage'} — progress has stalled",
                           {"company_age_years": age, "stage": m.get("stage")}))

    if customers == 0 and age >= 2:
        flags.append(_flag("no_traction", "medium",
                           f"No customers after {age:.0f} years in market",
                           {"customer_count": customers, "company_age_years": age}))

    if failure_prob is not None and failure_prob >= rd.get("high_failure_probability", 0.6):
        flags.append(_flag("model_failure_signal", "high",
                           f"Trained failure model puts 12-month failure risk at {failure_prob:.0%}",
                           {"failure_12m": failure_prob}))
    if funding_prob is not None and funding_prob < rd.get("low_funding_probability", 0.35):
        flags.append(_flag("fundraising_risk", "high",
                           f"Funding-readiness model puts next-round probability at only {funding_prob:.0%}",
                           {"funding_probability": funding_prob}))
    return flags


def detect_risks(metrics: dict[str, Any],
                 failure_prob: float | None = None,
                 funding_prob: float | None = None) -> dict[str, Any]:
    """Build the full risk register from real questionnaire metrics (+ optional model signals)."""
    cfg = get_config()
    thr = cfg["failure_thresholds"]
    rd = cfg.get("risk_detection", {})
    weights = rd.get("category_weights", {
        "financial": 0.35, "customer": 0.25, "market": 0.15, "team": 0.10, "execution": 0.15,
    })

    category_flags = {
        "financial": _financial_flags(metrics, thr),
        "customer": _customer_flags(metrics, thr),
        "market": _market_flags(metrics, rd),
        "team": _team_flags(metrics, rd),
        "execution": _execution_flags(metrics, rd, failure_prob, funding_prob),
    }

    categories = {}
    overall = 0.0
    for name, flags in category_flags.items():
        score = _category_score(flags)
        categories[name] = {
            "score": round(score, 1),
            "level": _level_for(score),
            "flags": flags,
        }
        overall += score * weights.get(name, 0.0)

    all_flags = [f | {"category": cat} for cat, flags in category_flags.items() for f in flags]
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    top_risks = sorted(all_flags, key=lambda f: sev_rank[f["severity"]])[:5]

    return {
        "overall_risk_score": round(overall, 1),
        "risk_level": _level_for(overall),
        "categories": categories,
        "top_risks": top_risks,
        "flag_count": len(all_flags),
        "model_signals": {
            "failure_12m": failure_prob,
            "funding_probability": funding_prob,
        },
        "weights": weights,
        "method": "deterministic risk register (config-driven thresholds)",
    }
