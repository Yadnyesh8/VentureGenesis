"""AGI Pre-Conditioner — LLM reasoning layer (Feature 2).

Narrates *how* the business model breaks at each AGI milestone and proposes AGI-resistant
redesigns, grounded in the deterministic exposure assessment. Like every reasoning agent it
calls a live model and raises on failure (no mock/heuristic substitute).
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents.ml import agi_exposure


def precondition(metrics: dict[str, Any], moats: dict[str, float] | None = None) -> dict[str, Any]:
    """Full AGI Pre-Conditioner: deterministic exposure + live LLM breakage/redesign."""
    assessment = agi_exposure.assess(metrics, moats)
    narrative = llm.complete(render_prompt("agi_precondition", context=metrics, assessment=assessment))
    return {**assessment, **narrative}
