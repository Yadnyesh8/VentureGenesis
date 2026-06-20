"""Corporate Spin-out Viability (Feature 3, deterministic layer).

Resolves the Innovator's Dilemma numerically: compute the expected value of an internal
R&D project two ways — kept as an internal business unit vs. spun out as an independent
VC-backed startup — and recommend the higher-EV path beyond a confidence margin.

The two EVs are coupled through a single **spin_quality** score in [0,1] built from the
project's factors, so the recommendation is genuinely factor-driven rather than dominated by
the VC upside constant. Factor directions (config-weighted, `config.json -> spinout`):

  high market_disruption   -> spin out (a disruptive bet gets starved inside the core org)
  high talent_flight_risk  -> spin out (retain key people with startup equity)
  low  strategic_adjacency -> spin out (poor fit with the parent's assets/strategy)
  low  capital_intensity   -> spin out (a lean startup can raise; capital-heavy stays internal)
  low  cannibalization     -> spin out (don't arm an external competitor to your core revenue)

The independent-survival probability reuses the trained failure model when standalone
metrics are supplied; otherwise it falls back to a config-prior base (ML fallback convention).
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_config


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _survival_probability(metrics: dict[str, Any] | None) -> tuple[float, str]:
    """P(survive as an independent startup). Trained model if metrics given, else prior."""
    cfg = get_config()["spinout"]
    if metrics:
        try:
            from app.agents.ml.failure_prediction import predict_failure

            failure = predict_failure(metrics)["failure_12m"]
            return _clamp(1 - failure - cfg["independent_failure_inflation"]), "failure_model"
        except Exception:
            pass
    return _clamp(0.5 - cfg["independent_failure_inflation"]), "prior"


def _spin_quality(project: dict[str, Any]) -> tuple[float, dict[str, float]]:
    """Weighted [-1,1] spin-out advantage -> [0,1] quality, plus each factor's contribution."""
    w = get_config()["spinout"]["factor_weights"]
    disruption = _clamp(project.get("market_disruption", 0.5))
    cannibalization = _clamp(project.get("cannibalization_risk", 0.5))
    capital = _clamp(project.get("capital_intensity", 0.5))
    talent_flight = _clamp(project.get("talent_flight_risk", 0.5))
    adjacency = _clamp(project.get("strategic_adjacency", 0.5))

    contributions = {
        "market_disruption": w["market_disruption"] * (2 * disruption - 1),
        "talent_flight_risk": w["talent_flight_risk"] * (2 * talent_flight - 1),
        "strategic_adjacency": w["strategic_adjacency"] * (1 - 2 * adjacency),
        "capital_intensity": w["capital_intensity"] * (1 - 2 * capital),
        "cannibalization_risk": w["cannibalization_risk"] * (1 - 2 * cannibalization),
    }
    score = sum(contributions.values())  # in [-1, 1] since weights sum to 1
    return _clamp(0.5 + 0.5 * score), {k: round(v, 4) for k, v in contributions.items()}


def _evs(project: dict[str, Any], metrics: dict[str, Any] | None):
    """Return (ev_spinout, ev_internal, spin_quality, contributions, survive, basis)."""
    cfg = get_config()["spinout"]
    base = cfg["base_project_value"]
    sq, contributions = _spin_quality(project)
    survive, basis = _survival_probability(metrics)

    ev_spinout = base * cfg["vc_upside_multiple"] * survive * sq
    ev_internal = base * cfg["parent_capture"] * (1 - cfg["org_drag"]) * (1 + (1 - sq))
    return round(max(0.0, ev_spinout), 4), round(max(0.0, ev_internal), 4), sq, contributions, survive, basis


def _decide(ev_spinout: float, ev_internal: float) -> str:
    margin = get_config()["spinout"]["decision_margin"]
    if ev_spinout > ev_internal * (1 + margin):
        return "SPIN_OUT"
    if ev_internal > ev_spinout * (1 + margin):
        return "KEEP_INTERNAL"
    return "TOSS_UP"


def assess(project: dict[str, Any], metrics: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return EV_internal, EV_spinout, the recommendation, and the decision flip-factor."""
    ev_spinout, ev_internal, sq, contributions, survive, basis = _evs(project, metrics)
    rec = _decide(ev_spinout, ev_internal)

    return {
        "recommendation": rec,
        "ev_spinout": ev_spinout,
        "ev_internal": ev_internal,
        "delta": round(ev_spinout - ev_internal, 4),
        "spin_quality": round(sq, 3),
        "survival_probability": round(survive, 3),
        "survival_basis": basis,
        "factor_contributions": contributions,
        "factors": {
            "market_disruption": _clamp(project.get("market_disruption", 0.5)),
            "cannibalization_risk": _clamp(project.get("cannibalization_risk", 0.5)),
            "capital_intensity": _clamp(project.get("capital_intensity", 0.5)),
            "talent_flight_risk": _clamp(project.get("talent_flight_risk", 0.5)),
            "strategic_adjacency": _clamp(project.get("strategic_adjacency", 0.5)),
        },
        "flip_factor": _flip_factor(project, metrics, rec),
    }


def _flip_factor(project: dict[str, Any], metrics: dict[str, Any] | None, current: str) -> dict[str, Any] | None:
    """Find the single project input whose extreme value would flip the recommendation."""
    fields = ["market_disruption", "cannibalization_risk", "capital_intensity",
              "talent_flight_risk", "strategic_adjacency"]
    for field in fields:
        for val in (0.0, 1.0):
            probe = dict(project)
            probe[field] = val
            ev_s, ev_i, *_ = _evs(probe, metrics)
            if _decide(ev_s, ev_i) != current:
                return {"field": field, "set_to": val, "would_become": _decide(ev_s, ev_i)}
    return None
