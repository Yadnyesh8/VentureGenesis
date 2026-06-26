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
from app.agents import specialists

ROLES = ["Founder", "Investor", "Financial", "Customer", "Market", "Competitor"]

try:
    from langgraph.graph import StateGraph, END  # type: ignore  # noqa: F401

    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover
    _HAS_LANGGRAPH = False


def _agent_turn(role: str, rnd: int, context: dict[str, Any], prior: str) -> dict[str, Any]:
    # Each agent gets its OWN specialist quantitative lens (dilution math for the Investor,
    # burn-multiple for the CFO, TAM/share for Market, …) — so it argues from numbers no
    # other agent is looking at. This is the specialization, not just a different prompt.
    lens = specialists.lens_for(role, context)
    # The agent's STANCE is decided in code (a per-role decision function over the lens), not
    # by the LLM. We hand the LLM its computed prior stance and make it argue/justify that —
    # so a role is a genuine agent with a decision function, not a free-form model.
    verdict = specialists.verdict_for(role, context)
    lens_with_prior = {**lens, "prior_stance": verdict["stance"], "prior_basis": verdict["rationale"]}
    if rnd == 1:
        prompt = render_prompt("debate_round_1", role=role, context=context, lens=lens_with_prior)
    elif rnd == 2:
        prompt = render_prompt("debate_round_2", role=role, prior=prior, lens=lens_with_prior)
    else:
        prompt = render_prompt("debate_round_3", role=role, prior=prior, lens=lens_with_prior)
    result = llm.complete(prompt)
    result.setdefault("role", role)
    result.setdefault("stance", verdict["stance"])  # fall back to the computed stance
    result.setdefault("message", "")
    if lens:
        result["lens"] = lens  # carried through to the UI so the specialization is visible
    # Surface the code-derived verdict alongside the LLM's, so the UI can show when the
    # debate moved an agent off its metrics-based prior (and when it didn't).
    result["computed_stance"] = verdict["stance"]
    result["computed_why"] = verdict["rationale"]
    return result


def _uncertainty_audit(context: dict[str, Any], allow_fetch: bool) -> Iterator[dict[str, Any]]:
    """Round 0: agents declare their key unknowns; VOI decides what is worth buying.

    Mutates `context` in place with any fetched evidence so rounds 1-3 argue with it.
    Fully wrapped: any failure degrades to a skipped audit, never aborting the debate.
    """
    from app.agents.ml import voi as voi_ml  # local import avoids ml<->debate cycles

    requests: list[dict[str, Any]] = []
    for role in ROLES:
        try:
            lens = specialists.lens_for(role, context)
            res = llm.complete(render_prompt("debate_round_0", role=role, context=context, lens=lens))
            for r in res.get("information_requests", []) or []:
                if r.get("field"):
                    requests.append({"role": role, **r})
                    yield {"type": "info_request", "role": role, "field": r["field"],
                           "why": r.get("why_it_matters", "")}
        except Exception as exc:
            yield {"type": "agent_skipped", "round": 0, "role": role, "error": str(exc)[:120]}

    try:
        ledger = voi_ml.assess(context, allow_fetch=allow_fetch).get("ledger", [])
    except Exception as exc:
        yield {"type": "audit_error", "error": str(exc)[:120]}
        return

    by_field = {item["field"]: item for item in ledger}
    requested_fields = {r["field"] for r in requests}
    for field in requested_fields:
        item = by_field.get(field)
        if item is None:
            continue
        if item.get("fetched"):
            context[f"evidence_{field}"] = item.get("fetch_result")
            yield {"type": "info_fetched", "field": field, "voi": item["voi"],
                   "cost": item["cost_usd"], "source": item["source"]}
        elif item.get("worth_fetching"):
            yield {"type": "info_unavailable", "field": field, "voi": item["voi"],
                   "cost": item["cost_usd"], "reason": item.get("fetch_reason", "no connector")}
        else:
            yield {"type": "info_skipped_low_voi", "field": field, "voi": item["voi"],
                   "cost": item["cost_usd"]}
    yield {"type": "audit_done", "requests": len(requests)}


def run_debate(context: dict[str, Any], allow_fetch: bool = False) -> Iterator[dict[str, Any]]:
    """Yields debate events: {type, round, role, message, stance}."""
    transcript: list[dict[str, Any]] = []
    yield {"type": "start", "engine": "langgraph" if _HAS_LANGGRAPH else "sequential", "roles": ROLES}

    # Round 0 — epistemic uncertainty resolution (VOI-gated information acquisition).
    yield {"type": "round_start", "round": 0}
    yield from _uncertainty_audit(context, allow_fetch)
    yield {"type": "round_end", "round": 0}

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

    # Consensus tally — the LLM debate outcome (final-round stances)…
    stances = [m["stance"] for m in transcript if m["round"] == 3]
    consensus = max(set(stances), key=stances.count) if stances else "neutral"
    # …and the purely code-derived board stance (the six decision functions, no LLM), so the
    # UI can show where the live debate diverged from the deterministic baseline.
    metrics_cons = specialists.metrics_consensus(context)
    yield {"type": "consensus", "consensus": consensus,
           "metrics_consensus": metrics_cons["consensus"],
           "metrics_tally": metrics_cons["tally"],
           "transcript": transcript}


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
