"""LLM client — OpenRouter (OpenAI-compatible). No mock fallback.

Every reasoning agent calls a real model through OpenRouter. If the key is missing or
the call fails, an LLMError is raised and surfaced to the caller (the UI shows the error)
— there is intentionally NO deterministic/mock substitute.
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

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Free OpenRouter tier allows ~20 req/min. Keep a margin and self-throttle so multi-agent
# runs (board/debate fire many calls) don't 429. Real work => real time, by design.
_RATE_LIMIT = int(os.getenv("OPENROUTER_RPM", "18"))
_WINDOW = 60.0
_calls: deque[float] = deque()
_lock = threading.Lock()
_MAX_RETRIES = 4


class LLMError(RuntimeError):
    pass


# Resilient free-model order: the user's configured model first, then known-good free
# models OpenRouter currently serves. All are real LLMs.
_FALLBACK_MODELS = [
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "z-ai/glm-4.5-air:free",
]


_last_good: str | None = None


def _model_chain() -> list[str]:
    primary = settings.OPENROUTER_MODEL or get_config().get("llm", {}).get("model", "")
    chain: list[str] = []
    # Prefer the most recently successful model so we don't re-pay for a saturated primary.
    if _last_good:
        chain.append(_last_good)
    if primary and primary not in chain:
        chain.append(primary)
    for m in _FALLBACK_MODELS:
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
    """Run a chat completion via OpenRouter and return parsed JSON."""
    if not settings.OPENROUTER_API_KEY:
        raise LLMError("OPENROUTER_API_KEY is not configured")

    system = system or get_prompt("system_base")
    cfg = get_config().get("llm", {})

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "VENTUREGENESIS",
    }
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    last_err = ""
    attempts = 0
    max_attempts = 6  # hard cap so one logical call can't thrash for minutes
    # Two passes over the model chain. A saturated/erroring model is skipped immediately
    # (we don't burn retries on it) so we reach a working free model fast. Every candidate
    # is a real LLM call — resilience, not a mock substitute.
    for _pass in range(2):
        for model in _model_chain():
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
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            try:
                resp = httpx.post(OPENROUTER_URL, json=payload, headers=headers, timeout=45)
            except Exception as exc:
                last_err = f"{model}: request failed/slow: {exc}"
                continue  # slow upstream -> next model

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
                raise LLMError(f"Unexpected OpenRouter response: {str(data)[:200]}") from exc
            try:
                parsed = _extract_json(text)
            except LLMError as exc:
                # Free models occasionally emit malformed JSON; retry (non-deterministic).
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
    if settings.OPENROUTER_API_KEY:
        return f"openrouter:{settings.OPENROUTER_MODEL}"
    return "unconfigured"
