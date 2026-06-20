"""Config-driven architecture (Phase 10).

Loads config.json and prompts.yaml. Supports hot reload so config/prompt changes
reflect immediately without a restart. Environment variables supply secrets and config paths.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from functools import lru_cache
from typing import Any

import yaml

# Load the project .env (repo root) so OPENROUTER_* etc. are available to uvicorn.
try:
    from dotenv import load_dotenv

    _ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    load_dotenv(_ENV_PATH)
except Exception:
    pass

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
CONFIG_PATH = CONFIG_DIR / "config.json"
PROMPTS_PATH = CONFIG_DIR / "prompts.yaml"

# When true, files are re-read on every access (great for live demos / hackathons).
HOT_RELOAD = os.getenv("VG_HOT_RELOAD", "true").lower() == "true"

_config_cache: dict[str, Any] | None = None
_prompts_cache: dict[str, Any] | None = None


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, "r") as f:
        return json.load(f)


def _read_yaml(path: Path) -> dict[str, Any]:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def get_config() -> dict[str, Any]:
    global _config_cache
    if HOT_RELOAD or _config_cache is None:
        _config_cache = _read_json(CONFIG_PATH)
    return _config_cache


def get_prompts() -> dict[str, Any]:
    global _prompts_cache
    if HOT_RELOAD or _prompts_cache is None:
        _prompts_cache = _read_yaml(PROMPTS_PATH)
    return _prompts_cache


def get_prompt(name: str) -> str:
    return get_prompts().get(name, "")


def render_prompt(name: str, **kwargs: Any) -> str:
    """Substitute {placeholders} without tripping on literal JSON braces in the template."""
    template = get_prompt(name)
    for key, value in kwargs.items():
        template = template.replace("{" + key + "}", str(value))
    return template


class Settings:
    """Runtime/secret settings from environment."""

    PROJECT_NAME = "VENTUREGENESIS"
    API_V1 = "/api"
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://venture:venture@localhost:5432/venturegenesis",
    )
    # Fallback to SQLite when Postgres is unreachable (keeps the demo alive).
    SQLITE_FALLBACK = os.getenv("SQLITE_FALLBACK", "sqlite:///./venturegenesis.db")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-2-9b-it:free")
    # Featherless (OpenAI-compatible). Set LLM_PROVIDER=featherless to make it active.
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")
    FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
    FEATHERLESS_MODEL = os.getenv("FEATHERLESS_MODEL", "google/gemma-4-31B-it")
    FEATHERLESS_BASE_URL = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
    # Clerk webhook signing secret (whsec_...) — verifies inbound user-sync events.
    CLERK_WEBHOOK_SIGNING_SECRET = os.getenv("CLERK_WEBHOOK_SIGNING_SECRET", "")
    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
    NEO4J_URI = os.getenv("NEO4J_URI", "")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")


settings = Settings()
