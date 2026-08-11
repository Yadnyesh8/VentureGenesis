"""LLM client — OpenAI-compatible providers (Featherless / OpenRouter). No mock fallback.

Every reasoning agent calls a real model through the configured provider. If the key is
missing or the call fails, an LLMError is raised and surfaced to the caller (the UI shows
the error) — there is intentionally NO deterministic/mock substitute.

The active provider is chosen by LLM_PROVIDER (env) or config.json "llm.provider".
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from collections import deque
from typing import Any

import httpx

from app.core.config import get_config, get_prompt, settings

logger = logging.getLogger("venturegenesis.llm")

# Self-throttle so multi-agent runs (board/debate fire many calls) stay under provider
# rate limits. Real work => real time, by design.
_RATE_LIMIT = int(os.getenv("LLM_RPM", os.getenv("OPENROUTER_RPM", "18")))
_WINDOW = 60.0
_calls: deque[float] = deque()
_lock = threading.Lock()
_MAX_RETRIES = 4


class LLMError(RuntimeError):
    pass


# Resilience chain for OpenRouter: when the primary is rate-limited or dropped,
# fall through these in order.
#
# Every entry must currently exist on the free tier AND advertise
# `response_format`, because the OpenRouter path below sets json_mode=True. The
# previous list had gone stale — four of its five models are no longer served
# free, so the chain silently collapsed to a single option. Checked against
# https://openrouter.ai/api/v1/models; re-verify when models are swapped in.
_OPENROUTER_FALLBACKS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
]


_last_good: str | None = None


def _provider() -> dict[str, Any]:
    """Resolve the active provider into a uniform config (key, url, model, headers...)."""
    cfg = get_config().get("llm", {})
    name = (settings.LLM_PROVIDER or cfg.get("provider") or "openrouter").lower()
    if name == "featherless":
        base = settings.FEATHERLESS_BASE_URL.rstrip("/")
        return {
            "name": "featherless",
            "url": f"{base}/chat/completions",
            "key": settings.FEATHERLESS_API_KEY,
            "key_env": "FEATHERLESS_API_KEY",
            "model": settings.FEATHERLESS_MODEL or cfg.get("model", ""),
            "fallbacks": [],
            "headers": {},
            "json_mode": False,  # Gemma on Featherless doesn't take response_format; we parse tolerantly
        }
    return {
        "name": "openrouter",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "key": settings.OPENROUTER_API_KEY,
        "key_env": "OPENROUTER_API_KEY",
        "model": settings.OPENROUTER_MODEL or cfg.get("model", ""),
        "fallbacks": _OPENROUTER_FALLBACKS,
        "headers": {"HTTP-Referer": "http://localhost:3000", "X-Title": "VENTUREGENESIS"},
        "json_mode": True,
    }


def _model_chain(provider: dict[str, Any]) -> list[str]:
    primary = provider["model"]
    chain: list[str] = []
    # Prefer the most recently successful model so we don't re-pay for a saturated primary.
    if _last_good:
        chain.append(_last_good)
    if primary and primary not in chain:
        chain.append(primary)
    for m in provider["fallbacks"]:
        if m not in chain:
            chain.append(m)
    return chain


def _throttle() -> None:
    """Block until issuing a request stays under the per-minute budget."""
    while True:
        with _lock:
            now = time.monotonic()
            while _calls and now - _calls[0] > _WINDOW:
                _calls.popleft()
            if len(_calls) < _RATE_LIMIT:
                _calls.append(now)
                return
            wait = _WINDOW - (now - _calls[0]) + 0.05
        logger.info("Rate-limit throttle: sleeping %.1fs", wait)
        time.sleep(max(wait, 0.1))


# A 429 has two very different meanings and they need opposite handling.
#
# Per-MINUTE: this model is momentarily saturated. Moving to the next model in
# the chain is exactly right, and the quota frees up seconds later.
#
# Per-DAY: the allowance is account-wide, so every model returns the same 429.
# Walking the chain then costs six attempts plus the _throttle() sleeps between
# them — observed as ~47s per agent — to arrive at the failure we already knew
# about on the first response. Treat it as terminal and report it verbatim.
_DAILY_QUOTA_MARKERS = ("per-day", "per day", "daily limit", "quota exceeded")


def _is_daily_quota(body: str) -> bool:
    low = (body or "").lower()
    return any(marker in low for marker in _DAILY_QUOTA_MARKERS)


def _extract_json(text: str) -> dict[str, Any]:
    """Parse a JSON object out of a model response (tolerant of prose/fences)."""
    text = (text or "").strip()
    text = re.sub(r"```(?:json)?|```", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    raise LLMError(f"Model did not return valid JSON: {text[:200]}")


def complete(prompt: str, *, system: str | None = None, json_mode: bool = True) -> dict[str, Any]:
    """Run a chat completion via the active provider and return parsed JSON."""
    provider = _provider()
    if not provider["key"]:
        raise LLMError(f"{provider['key_env']} is not configured")

    system = system or get_prompt("system_base")
    cfg = get_config().get("llm", {})

    headers = {
        "Authorization": f"Bearer {provider['key']}",
        "Content-Type": "application/json",
        **provider["headers"],
    }
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    use_json_mode = json_mode and provider["json_mode"]

    last_err = ""
    attempts = 0
    max_attempts = 6  # hard cap so one logical call can't thrash for minutes
    # Two passes over the model chain. A saturated/erroring model is skipped immediately
    # (we don't burn retries on it) so we reach a working model fast. Every candidate is a
    # real LLM call — resilience, not a mock substitute.
    for _pass in range(2):
        for model in _model_chain(provider):
            if attempts >= max_attempts:
                break
            attempts += 1
            _throttle()
            payload = {
                "model": model,
                "messages": messages,
                "temperature": cfg.get("temperature", 0.4),
                "max_tokens": cfg.get("max_tokens", 1024),
            }
            if use_json_mode:
                payload["response_format"] = {"type": "json_object"}
            try:
                resp = httpx.post(provider["url"], json=payload, headers=headers, timeout=45)
            except Exception as exc:
                last_err = f"{model}: request failed/slow: {exc}"
                continue  # slow upstream -> next model

            if resp.status_code == 429 and _is_daily_quota(resp.text):
                # Terminal for every model on this key — stop, don't walk the chain.
                raise LLMError(
                    f"{provider['name']} daily quota exhausted. {resp.text[:200]}"
                )

            if resp.status_code in (404, 429) or resp.status_code >= 500:
                last_err = f"{model}: {resp.status_code} {resp.text[:100]}"
                continue  # saturated/unavailable -> next model immediately

            if resp.status_code != 200:
                last_err = f"{model}: {resp.status_code} {resp.text[:120]}"
                continue

            try:
                data = resp.json()
            except Exception:
                last_err = f"{model}: non-JSON HTTP body"
                continue
            if "choices" not in data:
                last_err = f"{model}: {str(data)[:120]}"
                continue
            try:
                text = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as exc:
                raise LLMError(f"Unexpected {provider['name']} response: {str(data)[:200]}") from exc
            try:
                parsed = _extract_json(text)
            except LLMError as exc:
                # Models occasionally emit malformed JSON; retry (non-deterministic).
                last_err = str(exc)
                logger.info("Bad JSON from %s; retrying", model)
                continue
            global _last_good
            _last_good = model
            return parsed
        if attempts >= max_attempts:
            break

    raise LLMError(f"All models failed after {attempts} attempts ({last_err})")


def mode() -> str:
    provider = _provider()
    if provider["key"]:
        return f"{provider['name']}:{provider['model']}"
    return "unconfigured"
