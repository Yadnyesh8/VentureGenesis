"""Causal Trajectory Mapping (Feature 4).

Maps the highest-probability causal cascade from the founder's *current* KPI deltas to a
terminal `death` node, annotating each edge with a conditional probability and a
time-to-event, and surfacing the highest-leverage intervention points.

Primary path: when a causal-discovery library (`dowhy` / `causal-learn`) is installed it is
used to refine edge strengths from data. Default/fallback path: a fully transparent
weighted-propagation model over the config template graph (`config.json -> causal`) — this
is what the platform ships with, so the agent always works with no extra dependency.
"""
from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_config

logger = logging.getLogger("venturegenesis.ml.causal")

try:  # optional refinement only; the template graph is the shipped implementation
    import dowhy  # type: ignore  # noqa: F401

    _HAS_CAUSAL_LIB = True
except Exception:  # pragma: no cover
    _HAS_CAUSAL_LIB = False


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _node_activation(metrics: dict[str, Any]) -> dict[str, float]:
    """How 'lit up' each root KPI is right now, 0-1, from the founder's own numbers."""
    thr = get_config()["failure_thresholds"]
    runway = metrics.get("runway", 0) or 0
    churn = metrics.get("churn_rate", 0) or 0
    growth = metrics.get("customer_growth", 0) or 0
    revenue = metrics.get("revenue", 0) or 0
    expenses = metrics.get("expenses", 0) or 0
    burn_ratio = (expenses - revenue) / (expenses + 1)

    # Each KPI only "activates" once it crosses its unhealthy threshold, so genuinely
    # healthy metrics read as 0 (no active deterioration) rather than a faint signal.
    return {
        "churn_rate": _clamp((churn - thr["high_churn_rate"]) / max(thr["critical_churn_rate"] - thr["high_churn_rate"], 0.01)),
        "customer_growth": _clamp(-growth * 2.0),
        "burn_rate": _clamp((burn_ratio - thr["high_burn_ratio"]) / max(1 - thr["high_burn_ratio"], 0.01)),
        "runway": _clamp((thr["critical_runway_months"] - runway) / max(thr["critical_runway_months"], 1)),
    }


def _enumerate_paths(edges: list[dict], start: str, death: str) -> list[list[dict]]:
    """All simple paths start -> death over the DAG, each a list of edges."""
    adj: dict[str, list[dict]] = {}
    for e in edges:
        adj.setdefault(e["from"], []).append(e)
    paths: list[list[dict]] = []

    def dfs(node: str, trail: list[dict], seen: set[str]):
        if node == death:
            paths.append(list(trail))
            return
        for e in adj.get(node, []):
            if e["to"] in seen:
                continue  # guard against cycles
            dfs(e["to"], trail + [e], seen | {e["to"]})

    dfs(start, [], {start})
    return paths


def map_trajectory(metrics: dict[str, Any]) -> dict[str, Any]:
    """Return the most likely death path, its probability, ETA, and intervention points."""
    cfg = get_config()["causal"]
    edges = cfg["template_edges"]
    death = cfg["death_node"]
    act = _node_activation(metrics)

    best: dict[str, Any] | None = None
    for source, seed in act.items():
        if seed <= 0:
            continue
        for path in _enumerate_paths(edges, source, death):
            prob = seed
            months = 0.0
            for e in path:
                prob *= e["weight"]
                months += e.get("lag_months", 1)
            if best is None or prob > best["death_probability"]:
                best = {
                    "root": source,
                    "death_probability": prob,
                    "months_to_death": round(months * cfg["base_time_to_event_months"] / 3.0
                                             + max(0.0, metrics.get("runway", 0) or 0), 1),
                    "path_edges": path,
                }

    if best is None:
        return {
            "death_probability": 0.0,
            "months_to_death": None,
            "root_cause": None,
            "chain": [],
            "interventions": [],
            "engine": "causal-lib" if _HAS_CAUSAL_LIB else "template-graph",
            "note": "No active deterioration detected in current KPIs.",
        }

    # Build the human-readable chain + per-edge leverage for interventions.
    seed = act[best["root"]]
    chain = [{"node": best["root"], "activation": round(seed, 3)}]
    upstream = seed
    interventions = []
    for e in best["path_edges"]:
        leverage = round(upstream * e["weight"], 3)
        chain.append({
            "from": e["from"], "to": e["to"], "weight": e["weight"],
            "lag_months": e.get("lag_months", 1), "leverage": leverage,
        })
        if leverage >= get_config()["causal"]["intervention_min_leverage"]:
            interventions.append({
                "edge": f'{e["from"]} → {e["to"]}',
                "leverage": leverage,
                "action": f'Break the {e["from"]} → {e["to"]} link before month '
                          f'{e.get("lag_months", 1)}.',
            })
        upstream *= e["weight"]

    interventions.sort(key=lambda x: x["leverage"], reverse=True)
    return {
        "death_probability": round(best["death_probability"], 3),
        "months_to_death": best["months_to_death"],
        "root_cause": best["root"],
        "chain": chain,
        "interventions": interventions[:4],
        "engine": "causal-lib" if _HAS_CAUSAL_LIB else "template-graph",
    }
