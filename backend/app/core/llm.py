"""LLM wrapper used by all reasoning agents.

- Uses Anthropic Claude (claude-opus-4-8) when an API key is present and mock mode is off.
- Falls back to a deterministic heuristic responder in mock mode or when no key /
  SDK is available, so the demo never breaks (Phase 10 constraint).

Every call returns a Python dict (parsed JSON), enforcing the JSON-only schema contract.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.config import get_config, get_prompt, is_mock_mode, settings

logger = logging.getLogger("venturegenesis.llm")

try:  # optional dependency
    import anthropic  # type: ignore

    _HAS_ANTHROPIC = True
except Exception:  # pragma: no cover
    _HAS_ANTHROPIC = False


def _extract_json(text: str) -> dict[str, Any]:
    """Best-effort parse of a JSON object out of an LLM response."""
    text = text.strip()
    # strip markdown fences if present
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return {"_raw": text}


def _live_call(prompt: str, system: str) -> dict[str, Any]:
    cfg = get_config().get("llm", {})
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=cfg.get("model", "claude-opus-4-8"),
        max_tokens=cfg.get("max_tokens", 1024),
        temperature=cfg.get("temperature", 0.4),
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(block.text for block in resp.content if hasattr(block, "text"))
    return _extract_json(text)


def complete(prompt: str, *, system: str | None = None, mock_fn=None) -> dict[str, Any]:
    """Run an LLM completion. `mock_fn` produces the deterministic fallback dict."""
    system = system or get_prompt("system_base")
    use_live = (
        not is_mock_mode()
        and _HAS_ANTHROPIC
        and bool(settings.ANTHROPIC_API_KEY)
    )
    if use_live:
        try:
            return _live_call(prompt, system)
        except Exception as exc:  # pragma: no cover
            logger.warning("LLM live call failed (%s); using fallback", exc)
    if mock_fn is not None:
        out = mock_fn()
        if isinstance(out, dict):
            out["_mock"] = True
        return out
    return {"_mock": True, "note": "no live LLM available", "prompt_echo": prompt[:200]}


def mode() -> str:
    if not is_mock_mode() and _HAS_ANTHROPIC and settings.ANTHROPIC_API_KEY:
        return "live"
    return "mock"
