"""External Knowledge Connector — the acquisition layer the VOI engine spends against.

Mirrors the design of `app/core/llm.py`: one entrypoint (`fetch`), provider-agnostic
adapters, and a per-run cost ledger. Every adapter has a **documented offline fallback**:
when no API key/library is configured it returns `{available: False, reason: ...}` instead
of raising, so the platform runs fully keyless (same convention as the ML agents).

Per-source cost / latency / reliability is read from `config.json -> knowledge_sources`;
that cost is the term the VOI engine compares the Value of Information against.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

from app.core.config import get_config

logger = logging.getLogger("venturegenesis.knowledge")

SOURCES = ("web_search", "market_data", "competitor_db", "internal")

# Per-run cache so the same (source, query) is never paid for twice in one board run.
_cache: dict[tuple[str, str], dict[str, Any]] = {}
# Running tally of external spend / fetches for guardrails + reporting.
_ledger: dict[str, float] = {"usd_spent": 0.0, "fetches": 0}


def reset_run() -> None:
    """Clear the per-run cache and spend ledger (call at the start of a board run)."""
    _cache.clear()
    _ledger["usd_spent"] = 0.0
    _ledger["fetches"] = 0


def ledger() -> dict[str, Any]:
    return dict(_ledger)


def source_meta(source: str) -> dict[str, Any]:
    """Cost/latency/reliability for a source (config-driven)."""
    cfg = get_config().get("knowledge_sources", {})
    return cfg.get(source, {"usd_cost": 0.0, "latency_ms": 0, "reliability": 0.5})


def cost_of(source: str) -> float:
    return float(source_meta(source).get("usd_cost", 0.0))


def _web_search(query: str) -> dict[str, Any]:
    """Live web search when a key is present; offline fallback otherwise.

    Wired to be drop-in for Tavily/Serper/Brave-style JSON APIs via env config. With no
    key, returns available=False so the VOI engine reports "would have cost $X" rather
    than fabricating an answer.
    """
    key = os.getenv("WEB_SEARCH_API_KEY")
    url = os.getenv("WEB_SEARCH_API_URL")
    if not (key and url):
        return {"available": False, "reason": "WEB_SEARCH_API_KEY/URL not set"}
    try:
        import httpx

        resp = httpx.post(url, json={"query": query}, headers={"Authorization": f"Bearer {key}"}, timeout=20)
        resp.raise_for_status()
        return {"available": True, "value": resp.json()}
    except Exception as exc:  # network/parse failure degrades, never crashes the run
        return {"available": False, "reason": f"web_search failed: {exc}"[:160]}


def _market_data(query: str) -> dict[str, Any]:
    key = os.getenv("MARKET_DATA_API_KEY")
    url = os.getenv("MARKET_DATA_API_URL")
    if not (key and url):
        return {"available": False, "reason": "MARKET_DATA_API_KEY/URL not set"}
    try:
        import httpx

        resp = httpx.get(url, params={"q": query}, headers={"Authorization": f"Bearer {key}"}, timeout=20)
        resp.raise_for_status()
        return {"available": True, "value": resp.json()}
    except Exception as exc:
        return {"available": False, "reason": f"market_data failed: {exc}"[:160]}


def _competitor_db(query: str) -> dict[str, Any]:
    key = os.getenv("COMPETITOR_DB_API_KEY")
    url = os.getenv("COMPETITOR_DB_API_URL")
    if not (key and url):
        return {"available": False, "reason": "COMPETITOR_DB_API_KEY/URL not set"}
    try:
        import httpx

        resp = httpx.get(url, params={"q": query}, headers={"Authorization": f"Bearer {key}"}, timeout=20)
        resp.raise_for_status()
        return {"available": True, "value": resp.json()}
    except Exception as exc:
        return {"available": False, "reason": f"competitor_db failed: {exc}"[:160]}


def _internal(query: str) -> dict[str, Any]:
    """Internal source = derive from data already on hand (no external dependency).

    The orchestrator passes any already-known context via the `query` payload; here it is
    simply echoed back as available so 'internal' gaps cost ~nothing to resolve.
    """
    return {"available": True, "value": {"note": "resolved from internal context", "query": query}}


_ADAPTERS = {
    "web_search": _web_search,
    "market_data": _market_data,
    "competitor_db": _competitor_db,
    "internal": _internal,
}


def fetch(source: str, query: str) -> dict[str, Any]:
    """Acquire a fact from `source`. Returns a uniform KnowledgeResult dict:

    {source, query, available, cost, latency_ms, reliability, value?|reason?}
    Cached per run; updates the spend ledger only on an actual (uncached) fetch.
    """
    if source not in _ADAPTERS:
        return {"source": source, "query": query, "available": False,
                "reason": f"unknown source '{source}'", "cost": 0.0}

    cache_key = (source, query)
    if cache_key in _cache:
        return _cache[cache_key]

    meta = source_meta(source)
    t0 = time.time()
    result = _ADAPTERS[source](query)
    latency_ms = int((time.time() - t0) * 1000)

    out = {
        "source": source,
        "query": query,
        "cost": float(meta.get("usd_cost", 0.0)),
        "reliability": float(meta.get("reliability", 0.5)),
        "latency_ms": latency_ms,
        **result,
    }
    if out.get("available"):
        _ledger["usd_spent"] += out["cost"]
        _ledger["fetches"] += 1
    _cache[cache_key] = out
    return out
