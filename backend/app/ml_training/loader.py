"""Load trained model bundles saved by train.py. Cached after first load."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

MODELS_DIR = Path(
    os.getenv("VG_MODELS_DIR", Path(__file__).resolve().parent.parent.parent.parent / "models")
)

_cache: dict[str, Any] = {}


def load_bundle(name: str) -> dict | None:
    if name in _cache:
        return _cache[name]
    path = MODELS_DIR / f"{name}.joblib"
    if not path.exists():
        _cache[name] = None
        return None
    try:
        import joblib

        bundle = joblib.load(path)
        _cache[name] = bundle
        return bundle
    except Exception:
        _cache[name] = None
        return None


def is_trained(name: str) -> bool:
    return load_bundle(name) is not None
