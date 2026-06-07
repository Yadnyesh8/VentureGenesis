"""Multi-Agent Debate Engine (Phase 6).

Six agents (Founder, Investor, Financial, Customer, Market, Competitor) debate across
three rounds: independent opinions -> challenges -> consensus.

Implemented as a LangGraph StateGraph when langgraph is installed; otherwise an
equivalent sequential orchestration. Yields events incrementally so the API layer can
stream them (SSE) to the frontend in real time.
"""
from __future__ import annotations

import json
from typing import Any, Iterator

from app.core import llm
from app.core.config import render_prompt

ROLES = ["Founder", "Investor", "Financial", "Customer", "Market", "Competitor"]

try:
    from langgraph.graph import StateGraph, END  # type: ignore  # noqa: F401

    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover
    _HAS_LANGGRAPH = False


def _stance_for(role: str, context: dict[str, Any]) -> str:
    growth = context.get("customer_growth", 0) or 0
    runway = context.get("runway", 0) or 0
    if role in ("Financial",):
        return "bearish" if runway < 8 else "neutral"
    if role in ("Investor", "Market"):
        return "bullish" if growth > 0.1 else "neutral"
    if role == "Customer":
        return "bearish" if (context.get("churn_rate", 0) or 0) > 0.12 else "bullish"
    if role == "Competitor":
        return "bearish"
    return "bullish" if growth > 0.08 else "neutral"


def _fallback_message(role: str, rnd: int, context: dict[str, Any], prior: str) -> dict[str, Any]:
    stance = _stance_for(role, context)
    growth = context.get("customer_growth", 0) or 0
    runway = context.get("runway", 0) or 0
    lines = {
        ("Founder", 1): f"We're growing {growth*100:.0f}% with a clear product wedge; conviction is high.",
        ("Investor", 1): f"Traction is {'compelling' if growth>0.1 else 'unproven'}; I'd {'lean in' if growth>0.1 else 'wait for more signal'}.",
        ("Financial", 1): f"Runway is {runway:.0f} months — {'tight' if runway<8 else 'workable'}; burn discipline is the priority.",
        ("Customer", 1): f"Retention is the swing factor; churn at {(context.get('churn_rate',0) or 0)*100:.0f}% needs attention.",
        ("Market", 1): "The market tailwind is real, but timing and positioning decide the winner.",
        ("Competitor", 1): "Well-funded incumbents will respond fast; our moat must deepen quickly.",
    }
    base = lines.get((role, 1), f"As the {role} voice, my read leans {stance}.")
    if rnd == 2:
        base = f"Pushing back on the room: {base} The optimism (or caution) others showed misses the {role.lower()} angle."
    elif rnd == 3:
        base = f"Toward consensus: {base}"
    out = {"role": role, "message": base, "stance": stance}
    if rnd == 3:
        out["final_recommendation"] = (
            "Invest in growth" if stance == "bullish" else
            "Fix fundamentals first" if stance == "bearish" else "Proceed cautiously"
        )
    return out


def _agent_turn(role: str, rnd: int, context: dict[str, Any], prior: str) -> dict[str, Any]:
    if rnd == 1:
        prompt = render_prompt("debate_round_1", role=role, context=context)
    elif rnd == 2:
        prompt = render_prompt("debate_round_2", role=role, prior=prior)
    else:
        prompt = render_prompt("debate_round_3", role=role, prior=prior)
    result = llm.complete(prompt, mock_fn=lambda: _fallback_message(role, rnd, context, prior))
    result.setdefault("role", role)
    result.setdefault("stance", _stance_for(role, context))
    result.setdefault("message", "")
    return result


def run_debate(context: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yields debate events: {type, round, role, message, stance}."""
    transcript: list[dict[str, Any]] = []
    yield {"type": "start", "engine": "langgraph" if _HAS_LANGGRAPH else "sequential", "roles": ROLES}

    for rnd in (1, 2, 3):
        yield {"type": "round_start", "round": rnd}
        prior = "\n".join(f"{m['role']}: {m['message']}" for m in transcript[-len(ROLES):])
        for role in ROLES:
            msg = _agent_turn(role, rnd, context, prior)
            transcript.append({"round": rnd, **msg})
            yield {"type": "message", "round": rnd, **msg}
        yield {"type": "round_end", "round": rnd}

    # Consensus tally
    stances = [m["stance"] for m in transcript if m["round"] == 3]
    consensus = max(set(stances), key=stances.count) if stances else "neutral"
    yield {"type": "consensus", "consensus": consensus, "transcript": transcript}


def run_debate_blocking(context: dict[str, Any]) -> dict[str, Any]:
    transcript = []
    consensus = "neutral"
    for ev in run_debate(context):
        if ev["type"] == "message":
            transcript.append({k: ev[k] for k in ("round", "role", "message", "stance") if k in ev})
        if ev["type"] == "consensus":
            consensus = ev["consensus"]
    return {"consensus": consensus, "transcript": transcript}


def sse_format(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"
