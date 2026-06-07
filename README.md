# VENTUREGENESIS 🧬

**An AI-native Startup Operating System that acts as a virtual board of directors.**
It predicts startup failure, forecasts revenue, scores funding readiness, analyzes
competitors & markets, runs a live multi-agent debate, simulates scenarios on a digital
twin, recommends pivots, and issues a single board decision — all with downloadable
executive reporting.

> Every ML model has a rule-based fallback and the whole system runs in **mock mode** by
> default, so the demo never breaks even with zero API keys or missing ML wheels.

---

## Architecture

```
frontend/   Next.js 14 + Tailwind (dark theme, Recharts, SSE debate streaming) — 12 pages
backend/    FastAPI + SQLAlchemy
            ├─ agents/ml/          XGBoost·LightGBM·Prophet·CatBoost·FinBERT·SHAP (+fallbacks)
            ├─ agents/intelligence Root-cause, Founder, Investor(VC), CFO, Competitor, Market
            ├─ agents/debate_engine 6-agent / 3-round LangGraph debate (streams over SSE)
            ├─ agents/board        Aggregates everything → board decision + full report
            ├─ simulation/         Digital twin, scenario engine, pivot gen/sim/optimize
            └─ config/             config.json (weights/multipliers) + prompts.yaml
data/       Bundled YC + Failory datasets used for seeding & upload demos
```

**Tech:** Next.js 14, React, Tailwind · FastAPI · PostgreSQL (SQLite auto-fallback) ·
LangGraph/LangChain · XGBoost/LightGBM/CatBoost/Prophet/FinBERT · SHAP · Redis · Docker.

---

## Quick start

### Option A — Docker (everything: frontend, backend, postgres, redis)

```bash
cp .env.example .env          # works as-is in mock mode
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API docs → http://localhost:8000/docs

### Option B — Local dev

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-min.txt     # fast; sklearn-trained models + rule-based fallbacks
# (or: pip install -r requirements.txt   for the full ML/LLM stack)
python -m app.ml_training.train         # train real models on the bundled YC/Failory data
python seed.py                          # import real YC companies for reference (SQLite if no Postgres)
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:3000 → you'll be sent to **/onboarding** to answer a short
questionnaire about your startup. Everything downstream is computed from those answers.

**Frontend**
```bash
cd frontend
npm install
npm run dev                             # http://localhost:3000  (proxies /api → :8000)
```

---

## Using it

1. **Onboarding questionnaire** (4 steps) — name, industry, stage, founding year, team
   size, revenue/expenses/burn/cash, customers/growth/churn, funding/valuation, and
   optional customer reviews. No demo data is pre-filled; runway is computed from
   cash ÷ burn. Your profile is persisted and drives everything.
2. Explore each agent page: **Health, Failure (SHAP), Forecast, Funding, Customer,
   Competitor, Market, Pivots, Simulation**.
3. **Board** → click *Run Debate* to watch 6 agents debate live (streamed), then
   *Board Decision* for the aggregated verdict.
4. **Report** → full executive report, "Download PDF" via browser print.

> Re-run onboarding any time via **Edit profile** / **Start over** on the dashboard.

---

## The ML models (trained on real data — no synthetic training)

`python -m app.ml_training.train` trains two **GradientBoosting** classifiers on the
**6,089 real YC + Failory companies** bundled in `data/`, using only features a founder
can supply (team size, company age, industry, stage):

| Model | Target | Holdout |
|---|---|---|
| `failure_model` | status == Inactive (dead) | **AUC ≈ 0.84** |
| `funding_model` | Acquired / Public / top-company | **AUC ≈ 0.79** |

At inference, the trained model produces a data-driven **base probability**, which is
then adjusted by a transparent financial-risk layer using your *own* numbers (runway,
churn, growth, burn). Churn uses your reported metrics (no labeled churn dataset exists);
revenue forecasting projects deterministically from your reported revenue + growth;
sentiment runs only on reviews you provide (returns `no_data` otherwise). Nothing is
fabricated — if a trained model or input is missing, agents fall back to documented
rule-based logic.

---

## Going live (real LLM)

Set in `.env`:
```
VG_MOCK_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
```
Reasoning agents (understanding, root-cause, founder/investor/CFO/competitor/market,
debate, board, pivot generation) will call **Claude (`claude-opus-4-8`)**; ML agents use
trained models when their libraries are installed. Anything unavailable degrades to the
deterministic fallback automatically.

---

## Config-driven (no code changes needed)

- `backend/app/config/config.json` — scoring weights, industries, business models,
  stages, simulation multipliers, pivot-scoring weights, outlier thresholds, `mock_mode`.
- `backend/app/config/prompts.yaml` — every agent prompt.
- `VG_HOT_RELOAD=true` (default) re-reads both on every request — edits apply instantly,
  no restart. Live-editable via `GET/PUT /api/config`.

---

## Key API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/upload` | CSV upload + validation + understanding |
| `POST /api/failure` | Failure probabilities (6/12/24m) + SHAP |
| `POST /api/forecast` | Prophet revenue forecast (3/6/12m) |
| `POST /api/funding` | Funding probability + investor score |
| `POST /api/customer` | Churn risk + sentiment |
| `POST /api/health` | Weighted health score |
| `POST /api/competitor` `…/market` `…/strategy` | Intelligence agents |
| `POST /api/simulate` | Digital-twin scenario simulation |
| `POST /api/pivots` | Pivot generation → simulation → optimization |
| `POST /api/debate` · `POST /api/debate/stream` | Multi-agent debate (blocking / SSE) |
| `POST /api/board` | Aggregate all agents → board decision + full report |
| `GET/PUT /api/config` · `GET /api/status` | Config & health |

All accept either `{"startup_id": <id>}` or `{"metrics": {...}}`.

---

## Design constraints honored

- ✅ All agent outputs are consistent JSON.
- ✅ Every ML model has a rule-based fallback.
- ✅ Debate streams (SSE) instead of waiting for completion.
- ✅ Frontend degrades gracefully if an agent fails.
- ✅ Config changes reflect immediately (hot reload).
