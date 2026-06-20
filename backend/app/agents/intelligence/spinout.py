"""Corporate Spin-out Viability — LLM reasoning layer (Feature 3).

Turns the deterministic EV comparison into a board-grade rationale. Live LLM call; raises
on failure (no mock substitute), per convention.
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents.ml import spinout as spinout_ml


def evaluate(project: dict[str, Any], metrics: dict[str, Any] | None = None) -> dict[str, Any]:
    assessment = spinout_ml.assess(project, metrics)
    rationale = llm.complete(render_prompt("spinout", project=project, assessment=assessment))
    return {**assessment, **rationale}
