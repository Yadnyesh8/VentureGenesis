# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VENTUREGENESIS is an AI-native "startup operating system" — a virtual board of directors. A founder answers an onboarding questionnaire; the backend then runs ~16 agents (a mix of trained ML models and live LLM reasoning agents) to predict failure, forecast revenue, score funding readiness, run a multi-agent debate, simulate scenarios, recommend pivots, and issue a single board verdict with a downloadable report.

Two longer design docs exist and are worth reading for deep work: `README.md` (quick start, model metrics, endpoints) and `ARCHITECTURE.md` (full system design, diagrams, agent-by-agent breakdown).

## Commands

### Backend (FastAPI, from `backend/`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-min.txt      # fast: sklearn-trained models + rule-based fallbacks
# pip install -r requirements.txt        # full heavy ML/LLM stack (XGBoost, LightGBM, Prophet, etc.)
python -m app.ml_training.train          # train the two calibrated models on bundled YC/Failory data
python -m app.ml_training.evaluate       # inspect calibration + permutation importances
python seed.py                           # seed reference YC companies (SQLite if no Postgres)
uvicorn app.main:app --reload --port 8000   # API + docs at /docs
pytest tests/                            # run all tests
pytest tests/test_predictions.py         # single test file
pytest tests/test_predictions.py::test_name -v   # single test
```

### Frontend (Next.js 14, from `frontend/`)
```bash
npm install
npm run dev      # http://localhost:3000, proxies /api → :8000 (see next.config.js rewrites)
npm run build
npm run lint
```

### Full stack
```bash
cp .env.example .env      # works as-is
docker compose up --build # frontend :3000, backend :8000, postgres, redis
```

## Architecture: the big picture

### Request flow
Every analysis endpoint accepts **either** `{"startup_id": <id>}` **or** `{"metrics": {...}}` (inline questionnaire answers). `app/utils/resolve.py::resolve_metrics()` normalizes both into a single metrics dict — this is the universal entry point for agent input. There are **no demo/hardcoded values**: missing numeric fields default to `0` only to avoid crashes. Everything downstream is computed from the founder's actual answers.

Routes live in `app/api/routes/` (`analysis`, `debate`, `pipeline`, `upload`, `system`, `webhooks`), all mounted under `/api` in `app/main.py`. (`analysis` also serves the frontier agents — see below.)

### Two classes of agents
- **ML / stat agents** (`app/agents/ml/`) — local, instant: failure prediction, funding readiness, revenue forecast, sentiment, health score, risk detection (churn is a metric consumed by the health agent, not a standalone module). Each has a documented **rule-based fallback** used when its library or a trained model is missing.
- **LLM reasoning agents** — live calls: understanding, root-cause, founder/investor/CFO/competitor/market (`app/agents/intelligence/agents.py`), the 6-agent × 3-round debate (`app/agents/debate_engine.py`), pivot generation (`app/simulation/pivot.py`), the scenario digital twin (`app/simulation/digital_twin.py`, behind the `/simulation` page), and the board chairperson that aggregates everything (`app/agents/board.py`).

### Frontier agents (Features 1–4; see `docs/SPEC_FRONTIER_AGENTS.md`)
Four advanced engines, each a deterministic ML-style core (config-weighted, with fallback) plus an LLM narrative wrapper that raises on failure — same conventions as above:
- **Epistemic Uncertainty / VOI** (`app/agents/ml/voi.py` + `app/core/knowledge.py`) — ranks decision-critical unknowns by Value of Information (model-perturbation sensitivity, else config prior) vs the external-fetch **Cost**, fetching only when `VOI > Cost × (1+margin)` within a budget. Runs as **Round 0 of the debate** (`debate_engine.py::_uncertainty_audit`), emitting `info_request`/`info_fetched`/`info_skipped_low_voi` SSE events. The knowledge connector has offline fallbacks so it runs keyless.
- **AGI Pre-Conditioner** (`app/agents/ml/agi_exposure.py` + `intelligence/agi.py`) — per-vector AGI-exposure score + milestone survival curve.
- **Spin-out Viability** (`app/agents/ml/spinout.py` + `intelligence/spinout.py`) — Innovator's-Dilemma EV(spin-out) vs EV(internal) via a coupled `spin_quality` score; new `ProjectBase`/`SpinoutRequest` input domain (a project, not a startup).
- **Causal Trajectory** (`app/agents/ml/causal.py` + `intelligence/causal.py`) — template-graph propagation from current KPI deltas → `death` node, with intervention points; feeds edge leverage back into VOI weighting.

Routes: `POST /api/{voi,agi,spinout,causal}`. `agi` + `causal` are folded into `board.gather_all`/`_compact` and the `board/stream` pipeline; VOI rides inside the debate. New config blocks: `knowledge_sources`, `voi`, `agi_preconditioner`, `spinout`, `causal`. New prompts: `debate_round_0`, `agi_precondition`, `spinout`, `causal_trajectory`. Frontend pages: `/uncertainty`, `/agi`, `/spinout`, `/trajectory` (under the "Frontier" nav category). Deterministic engines are covered by `tests/test_frontier.py` (run on the minimal install).

### LLM layer (`app/core/llm.py`)
All reasoning agents go through `llm.complete()`. Key facts:
- **OpenAI-compatible providers only** (Featherless or OpenRouter), selected by `LLM_PROVIDER` env or `config.json` `llm.provider`. The current default in `config.json` is **Featherless** (`google/gemma-4-31B-it`).
- **There is intentionally NO mock/deterministic substitute for LLM agents** — if the key is missing or the call fails, an `LLMError` is raised and surfaced to the UI. (Note: `README.md` mentions Anthropic/`mock_mode`; that is stale — the code is OpenRouter/Featherless-only with no mock LLM.)
- Built-in **self-throttle** (`LLM_RPM`, default 18/min) and a **model-fallback chain** for OpenRouter free models, because board/debate fan out many calls. Multi-agent runs genuinely take minutes by design.
- The debate engine **streams over SSE** (`POST /api/debate/stream`); the frontend `AgentPipeline` component animates each agent lighting up live.

### Config-driven (hot reload)
`app/core/config.py` loads two files from `app/config/`:
- `config.json` — scoring weights, industries, business models, stages, simulation multipliers, pivot-scoring weights, outlier thresholds, and the `llm` block.
- `prompts.yaml` — every agent prompt.

With `VG_HOT_RELOAD=true` (default) both files are re-read **on every access**, so edits apply with no restart. Also live-editable via `GET/PUT /api/config`. Tune scoring and prompts here rather than changing code.

### ML training pipeline (`app/ml_training/`)
`train.py` trains two **calibrated HistGradientBoosting** pipelines on the **6,089 real YC + Failory companies** in `data/`, using only founder-suppliable features (team size, company age, industry, stage, plus derived stagnation/hiring-velocity signals). Includes leakage-safe target encoding, grid search with 5-fold stratified CV, and isotonic calibration. Models persist to `models/*.joblib`. At inference the trained model gives a base probability that a transparent financial-risk layer then adjusts using the founder's own runway/churn/growth/burn. Nothing is fabricated — missing model or input ⇒ documented rule-based fallback.

### Authentication (Clerk)
Auth is **Clerk**, wired on both ends:
- **Frontend** — `frontend/middleware.ts` (`clerkMiddleware`) gates everything except the public set: `/`, `/sign-in`, `/sign-up`, `/sso-callback`, and `/api(.*)` (the `/api` proxy is left open; the FastAPI backend is not gated by Clerk middleware). `ClerkProvider` wraps `app/layout.tsx`; custom auth pages live under `app/sign-in`, `app/sign-up`, `app/sso-callback`. Frontend keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) go in `frontend/.env.local`.
- **Backend** — `app/api/routes/webhooks.py` receives Clerk user lifecycle events at `POST /api/webhooks/clerk` and upserts/deletes rows in the `users` table (`clerk_id` keyed). Every request is **Svix signature-verified**: it uses the official `svix` library when installed and **falls back to a stdlib HMAC-SHA256 verifier** otherwise — same documented-fallback convention as the ML agents. Requires `CLERK_WEBHOOK_SIGNING_SECRET` (`whsec_...`); a missing secret returns 500 rather than silently trusting the event.

### Frontend (`frontend/`)
Next.js 14 App Router. `lib/store.tsx` (`StoreProvider`) holds the founder profile in localStorage and drives every page. `lib/api.ts` is the typed API client (requests proxied to the backend via `next.config.js` rewrites). One page per agent under `app/` (health, failure, forecast, funding, customer, competitor, market, pivots, simulation, board, report) plus onboarding/dashboard, and a `launching` screen that fires the full board pipeline **once** over SSE after onboarding and fans the results into a per-page cache so each agent page renders instantly afterward. **`reactStrictMode` is deliberately off** so effects don't double-fire the expensive agent calls in dev.

## Conventions that matter

- **All agent outputs are consistent JSON**, and the frontend degrades gracefully if an individual agent fails — preserve both properties when adding agents.
- **Every ML agent must keep a rule-based fallback.** LLM agents must not (they surface errors instead).
- Don't introduce hardcoded demo metrics; route all input through `resolve_metrics()`.
- Prefer changing `config.json` / `prompts.yaml` over hardcoding weights or prompt text.
- DB is PostgreSQL with automatic SQLite fallback — don't assume Postgres-only features.
