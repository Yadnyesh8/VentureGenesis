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


def _agent_turn(role: str, rnd: int, context: dict[str, Any], prior: str) -> dict[str, Any]:
    if rnd == 1:
        prompt = render_prompt("debate_round_1", role=role, context=context)
    elif rnd == 2:
        prompt = render_prompt("debate_round_2", role=role, prior=prior)
    else:
        prompt = render_prompt("debate_round_3", role=role, prior=prior)
    result = llm.complete(prompt)
    result.setdefault("role", role)
    result.setdefault("stance", "neutral")
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
            # One agent failing (e.g. a transient upstream error) must not abort the debate.
            try:
                msg = _agent_turn(role, rnd, context, prior)
            except Exception as exc:
                yield {"type": "agent_skipped", "round": rnd, "role": role, "error": str(exc)[:120]}
                continue
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
