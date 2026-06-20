"""Causal Trajectory Mapping — LLM reasoning layer (Feature 4).

Narrates the deterministic death path in plain language ("this is how you die, and where to
cut it"). Live LLM call; raises on failure (no mock substitute), per convention.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents.ml import causal as causal_ml


def narrate(metrics: dict[str, Any]) -> dict[str, Any]:
    trajectory = causal_ml.map_trajectory(metrics)
    if not trajectory.get("chain"):
        return trajectory  # nothing deteriorating → no narrative needed
    story = llm.complete(render_prompt("causal_trajectory", trajectory=trajectory, metrics=metrics))
    return {**trajectory, **story}
