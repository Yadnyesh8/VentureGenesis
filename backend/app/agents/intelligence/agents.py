"""Agent Intelligence Layer (Phase 5) — real LLM reasoning, no mock fallback.

Six reasoning agents, each backed by a live OpenRouter model:
  - Root Cause Analysis (consumes SHAP values)
  - Founder Strategy
  - Investor (VC Partner)
  - Financial Risk (CFO)
  - Competitor Intelligence
  - Market Opportunity
"""
from __future__ import annotations

from typing import Any

from app.core import llm
from app.core.config import render_prompt
from app.agents import specialists


def root_cause(shap_importance: list[dict], metrics: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("root_cause", shap=shap_importance, metrics=metrics))


def founder_strategy(context: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("founder_strategy", context=context))


def _lens_with_verdict(role: str, context: dict[str, Any]) -> dict[str, Any]:
    """Specialist lens plus the role's code-computed prior stance (decision function)."""
    lens = specialists.lens_for(role, context)
    v = specialists.verdict_for(role, context)
    return {**lens, "prior_stance": v["stance"], "prior_basis": v["rationale"]}


def investor(context: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("investor", context=context, lens=_lens_with_verdict("investor", context)))


def financial_risk(context: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("financial_risk", context=context, lens=_lens_with_verdict("financial_risk", context)))


def competitor(context: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("competitor", context=context, lens=_lens_with_verdict("competitor", context)))


def market_opportunity(context: dict[str, Any]) -> dict[str, Any]:
    return llm.complete(render_prompt("market", context=context, lens=_lens_with_verdict("market", context)))
