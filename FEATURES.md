# VENTUREGENESIS — Feature Reference

A deep, feature-by-feature breakdown of VENTUREGENESIS: **what each feature does**, **how it is implemented in code**, **which libraries and concepts power it**, and **the underlying ideas explained in plain language**.

VENTUREGENESIS is an AI-native "startup operating system" that behaves like a virtual board of directors. A founder answers an onboarding questionnaire; the backend then runs ~16 agents — a mix of **trained ML models** and **live LLM reasoning agents** — to predict failure, forecast revenue, score funding readiness, detect risk, run a 6-agent boardroom debate, simulate scenarios, recommend pivots, and finally issue one board verdict with a downloadable report.

> This document is generated from the actual source. Where the older `README.md`/`ARCHITECTURE.md` mention "mock mode" or Anthropic/Claude, that is **stale** — the live code is **OpenAI-compatible only (Featherless or OpenRouter)** with **no mock LLM substitute**. The current default provider is **Featherless** running `google/gemma-4-31B-it`.

---

## Table of contents

1. [System overview & request lifecycle](#1-system-overview--request-lifecycle)
2. [The universal input contract (`resolve_metrics`)](#2-the-universal-input-contract-resolve_metrics)
3. [Onboarding questionnaire](#3-onboarding-questionnaire)
4. [The ML training pipeline](#4-the-ml-training-pipeline)
5. [ML / statistical agents](#5-ml--statistical-agents)
   - 5.1 Failure Prediction
   - 5.2 Funding Readiness
   - 5.3 Revenue Forecast
   - 5.4 Customer Sentiment
   - 5.5 Startup Health Score
   - 5.6 Risk Detection
   - 5.7 Data Validation
6. [LLM reasoning agents](#6-llm-reasoning-agents)
   - 6.1 Startup Understanding
   - 6.2 Root Cause Analysis
   - 6.3 Founder Strategy
   - 6.4 Investor (VC)
   - 6.5 Financial Risk (CFO)
   - 6.6 Competitor Intelligence
   - 6.7 Market Opportunity
7. [The Debate Engine](#7-the-debate-engine)
8. [The Board (Chairperson) & full pipeline](#8-the-board-chairperson--full-pipeline)
9. [Digital Twin & Scenario Simulation](#9-digital-twin--scenario-simulation)
10. [Pivot Engine](#10-pivot-engine)
11. [The LLM resilience layer](#11-the-llm-resilience-layer)
12. [Config-driven architecture (hot reload)](#12-config-driven-architecture-hot-reload)
13. [Data persistence layer](#13-data-persistence-layer)
14. [CSV upload & ingestion](#14-csv-upload--ingestion)
15. [Authentication (Clerk) & webhooks](#15-authentication-clerk--webhooks)
16. [The frontend](#16-the-frontend)
17. [Streaming (SSE) infrastructure](#17-streaming-sse-infrastructure)
18. [API surface](#18-api-surface)
19. [Concept glossary](#19-concept-glossary)

---

## 1. System overview & request lifecycle

**What it does.** Turns a founder's questionnaire answers into a full board-level analysis, observable live, with no fabricated numbers.

**The end-to-end flow:**

1. **Onboarding** — the founder fills a 4-step form (company, finance, traction, capital + optional reviews). Runway is derived client-side as `cash ÷ monthly burn`.
2. **Profile stored** — saved to `localStorage` (via `StoreProvider`) and persisted to the DB through `POST /api/startups`.
3. **Launching screen** — kicks off the full board pipeline **once** over SSE and fans the results into a per-page cache so each agent page renders instantly afterward.
4. **`resolve_metrics()`** — every analysis endpoint normalizes `{startup_id}` **or** `{metrics}` into a single metrics dict.
5. **ML agents** run locally and instantly (trained `.joblib` models + transparent formulas).
6. **LLM agents** call `llm.complete()` → Featherless/OpenRouter → parsed JSON.
7. **Board pipeline** (`POST /api/board/stream`) runs all agents sequentially and streams `agent_start` / `agent_done` / `debate_message` / `complete` events.
8. **Persistence** — predictions, forecasts, debate transcripts, and pivots are written to their tables.

**Tech stack.**

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Charts / motion | Recharts, Framer Motion, GSAP, Lenis, Lottie, three.js / react-three-fiber |
| Auth | Clerk (`@clerk/nextjs`) |
| Backend | FastAPI + Uvicorn (async, OpenAPI docs, SSE) |
| ORM / DB | SQLAlchemy 2 + PostgreSQL with automatic SQLite fallback |
| ML | scikit-learn (HistGradientBoosting, IsolationForest, calibration), pandas, NumPy, joblib |
| ML (optional) | Prophet, SHAP, FinBERT/transformers, XGBoost/LightGBM/CatBoost |
| LLM | OpenAI-compatible providers (Featherless / OpenRouter) via `httpx` |
| Orchestration | LangGraph (optional) for the debate state machine |
| Config | `config.json` + `prompts.yaml`, hot-reloaded |
| Deploy | Docker Compose (frontend, backend, postgres, redis) |

`app/main.py` mounts five routers under `/api` (`system`, `upload`/`data`, `analysis`/`agents`, `debate`, `pipeline`, `webhooks`) and enables permissive CORS so the browser can call the backend directly (avoiding the dev proxy killing long-running agent calls).

---

## 2. The universal input contract (`resolve_metrics`)

**What it does.** Provides a single entry point for agent input so every endpoint accepts **either** a stored startup id **or** inline questionnaire answers.

**Implementation** (`app/utils/resolve.py`):

- Accepts a `StartupRef` with `startup_id`, `metrics`, `customer_reviews`, and `revenue_series`.
- If `startup_id` is given and a DB is available, it loads the row and copies its non-null fields.
- If inline `metrics` are given, they are merged on top (inline overrides stored).
- The 10 numeric keys (`revenue`, `expenses`, `burn_rate`, `runway`, `customer_count`, `customer_growth`, `churn_rate`, `funding_amount`, `employee_count`, `valuation`) default to `0` **only to prevent crashes** — explicitly *not* demo values.

**Concept — why this matters.** It is the architectural guarantee that "there are no hardcoded demo metrics." Everything downstream is computed from the founder's real answers; a missing field becomes a neutral `0`, never an invented figure.

---

## 3. Onboarding questionnaire

**What it does.** Collects the founder profile that drives every model and agent. No demo data is pre-filled.

**Implementation** (`frontend/app/onboarding/page.tsx`): a 4-step wizard + review pane.

| Step | Fields |
|---|---|
| Company | startup name*, industry* (loaded live from `/api/config`), business model, stage*, founding year, team size |
| Finance | annual revenue, annual expenses, monthly burn, cash in bank |
| Traction | customers, monthly growth rate (0–1), monthly churn rate (0–1) |
| Capital & Voice | total funding, valuation, optional customer reviews (one per line) |

(* = required, enforced client-side before advancing.)

**Notable mechanics.**
- **Runway is derived**, not asked: `runway = round(cash ÷ burn, 1)` — shown live on the Finance step.
- Industry options come from the backend `config.json` so the questionnaire's taxonomy matches the trained model's industry encoding.
- On finish, the profile is `POST`ed to `/api/startups` (best-effort; failure is non-fatal), reviews are saved separately, the profile is written to `localStorage`, and the user is routed to `/launching`.
- Saving a new/edited profile **invalidates all prior analysis cache** (so stale results never persist across profiles).

**Libraries.** Framer Motion (step transitions, animated progress bar), React state only — no form library.

---

## 4. The ML training pipeline

**What it does.** Trains the two predictive models on **6,089 real YC + Failory companies**, using only features a founder can actually supply. Run with `python -m app.ml_training.train`.

**Implementation** (`app/ml_training/train.py` + `features.py`).

### Datasets
`_load_dataset()` concatenates `data/yc_companies_algolia.csv` and `data/failory_dataset_yc_format.csv`, keeping rows with a non-null `status`.

### Two targets
- **`failure_model`** → `P(status == "Inactive")` (the company died).
- **`funding_model`** → `P(status ∈ {Acquired, Public} OR top_company == true)` (a fundable/success outcome).

### Features (shared between train & inference — `features.py`)
Exactly 6 features, deliberately limited to questionnaire-answerable signals:

| Feature | Meaning |
|---|---|
| `team_size` | employee count |
| `company_age_years` | derived from founding year / launch timestamp |
| `industry_code` | ordinal industry id (target-encoded inside the pipeline) |
| `stage_code` | ordinal funding-stage ladder (0 = Idea … 8 = Public, −1 = unknown) |
| `age_stage_gap` | `age − expected_age_for_stage` → a **stagnation** signal |
| `team_per_year` | `team ÷ (age + 1)` → a **hiring-velocity** proxy |

The `_derive()` function builds these identically at train and inference time so the two never drift.

### The model pipeline (`_make_pipeline`)
A scikit-learn `Pipeline`:
1. **`ColumnTransformer` → `TargetEncoder`** on the industry column only (binary target type, cross-fitted = **leakage-safe**), `remainder="passthrough"` for the numeric features.
2. **`HistGradientBoostingClassifier`** (`max_iter=400`).

### Training procedure (`_train_one`)
1. **Stratified 80/20 train/test split.**
2. **`GridSearchCV`** over a small regularization-heavy grid (learning rate, leaf nodes, min samples per leaf, L2, class weight) using **5-fold StratifiedKFold** scored on **ROC-AUC**.
3. **Isotonic probability calibration** via `CalibratedClassifierCV(method="isotonic")` so outputs are trustworthy probabilities, not just well-ranked scores.
4. **Honest holdout evaluation**: AUC, PR-AUC, Brier score, accuracy, best-F1 threshold.
5. **Permutation feature importances** (model-agnostic — needed because calibrated pipelines hide native tree importances).
6. Persist a **bundle** to `models/<name>.joblib` containing the model, feature names, industry map, importances, best params, metrics, and sample counts.

### Reported metrics

| Model | Target | 5-fold CV AUC | Holdout AUC | PR-AUC | Brier |
|---|---|---|---|---|---|
| `failure_model` | status == Inactive | ~0.863 ± 0.014 | ~0.842 | ~0.570 | ~0.112 |
| `funding_model` | Acquired/Public/top | ~0.784 ± 0.024 | ~0.784 | ~0.442 | ~0.102 |

`app/ml_training/evaluate.py` re-inspects calibration and permutation importances; `loader.py` loads & caches the bundles.

**Concepts explained.**
- **Gradient boosting** — builds many small decision trees in sequence, each correcting the previous one's errors; strong on tabular data. `HistGradientBoosting` is a fast histogram-binned variant.
- **Target encoding** — replaces a category (industry) with a cross-fitted estimate of its target rate; "cross-fitted" prevents the encoding from leaking each row's own label.
- **Isotonic calibration** — fits a monotonic mapping so that "70% predicted" actually means "~70% happened."
- **AUC** — 0.5 = random, 1.0 = perfect separation. **Brier** — mean squared error of probabilities (lower is better).

---

## 5. ML / statistical agents

All ML agents return consistent JSON, and each keeps a **documented rule-based fallback** (or, for trained models, raises a clear error instead of inventing numbers). The pattern: a **data-driven base** from the trained model, then a **transparent layer** that adjusts it using the founder's own financials — config-driven weights, fully auditable.

### 5.1 Failure Prediction

**File:** `app/agents/ml/failure_prediction.py` · **Endpoint:** `POST /api/failure`

**What it does.** Outputs failure probability at 6 / 12 / 24 months plus feature-level explanations.

**How it works.**
1. Loads `failure_model` bundle; if missing, **raises** (`Run: python -m app.ml_training.train`) — no fabricated heuristic.
2. Builds the 6-feature vector via `metrics_to_features` and gets `base_ml = model.predict_proba(...)`.
3. **Financial-risk layer** (`_financial_adjustment`) computes a delta from the founder's real numbers:
   - **runway** below the `critical_runway_months` line adds risk (weighted),
   - **churn** relative to `high_churn_rate` (capped),
   - **negative customer growth** penalized,
   - **burn ratio** `(expenses − revenue) / (expenses + 1)` penalized only above `high_burn_ratio`,
   - minus a `healthy_baseline_credit`, clamped to `[delta_min, delta_max]`.
4. Final `base = clamp(base_ml + delta, 0.02, 0.98)`.
5. **Horizons:** `failure_6m = base × 1.12`, `failure_12m = base`, `failure_24m = base × 0.88` (multipliers in config).
6. **Explainability:** uses saved permutation importances; if the `shap` package is present it computes per-prediction **SHAP** values via `TreeExplainer`; the financial contributions are always appended so you can see exactly which of *your* numbers moved the risk.

**Libraries / concepts.** scikit-learn, NumPy, optional SHAP. **SHAP** (Shapley values from cooperative game theory) fairly attributes the prediction across features. The output advertises its provenance: `"trained on N real companies, AUC ..."`.

### 5.2 Funding Readiness

**File:** `app/agents/ml/funding_readiness.py` · **Endpoint:** `POST /api/funding`

**What it does.** Outputs `funding_probability` and an `investor_score` (0–100).

**How it works.** Loads `funding_model`, gets the base probability, then adds a **traction adjustment** (`_traction_adjustment`): positive credit for customer growth, runway, and revenue (each normalized and weighted), minus a penalty if runway is below the critical line; clamped to `[delta_min, delta_max]`. Final probability clamped to `[0.02, 0.98]`; `investor_score = prob × 100`. Raises if the model is untrained.

### 5.3 Revenue Forecast

**File:** `app/agents/ml/revenue_forecast.py` · **Endpoint:** `POST /api/forecast`

**What it does.** Projects revenue 3 / 6 / 12 months out plus a monthly series for charting.

**How it works.**
1. If no revenue is reported (and no series passed), returns `method: "no_input"` with a note — **it does not fabricate** a forecast.
2. Otherwise `_synthesize_series` back-casts an 18-month monthly history from current revenue and the reported growth rate (clamped to a sane band, deterministic, no random noise).
3. **Prophet path** (if `prophet` installed and ≥6 months of data): fits a Prophet model (seasonality disabled), predicts 12 future months, clips negatives, sums for horizons. `method: "prophet"`.
4. **Fallback path** (`_fallback_forecast`): estimates a median month-over-month growth ratio and compounds it forward. `method: "compound_growth_fallback"`.

**Libraries / concepts.** Facebook **Prophet** (additive time-series model) when available; otherwise pure NumPy compound growth. Either way the projection is grounded in the founder's reported revenue.

### 5.4 Customer Sentiment

**File:** `app/agents/ml/sentiment.py` · **Endpoint:** `POST /api/customer`

**What it does.** Classifies customer reviews as positive / neutral / negative, with an aggregate score, distribution, and per-review breakdown.

**How it works.**
- **No reviews → `sentiment: "no_data"`** (never invents sentiment).
- **FinBERT path:** lazily loads the `ProsusAI/finbert` transformers pipeline (financial-text sentiment) and classifies each review (truncated to 512 chars).
- **Lexicon fallback:** a curated positive/negative word set; the label is whichever count is higher. `method: "finbert" | "lexicon"`.
- Aggregate score = `(positive − negative) / total`.

**Libraries / concepts.** HuggingFace `transformers` (FinBERT) if installed; otherwise a deterministic keyword lexicon. FinBERT is a BERT model fine-tuned on financial text.

### 5.5 Startup Health Score

**File:** `app/agents/ml/health.py` · **Endpoint:** `POST /api/health`

**What it does.** A single 0–100 health score with a letter grade and 5-pillar breakdown.

**How it works.** A transparent weighted formula (weights in `config.json → health_weights`):

| Pillar | Weight | Basis |
|---|---|---|
| Revenue strength | 25% | revenue vs. expenses, plus revenue scale |
| Growth rate | 25% | customer growth (offset + range normalized) |
| Funding readiness | 20% | the funding model's probability (or runway proxy) |
| Customer health | 15% | `1 − churn_rate` |
| Market position | 15% | valuation scale + growth |

Each pillar is clamped to `[0,1]`, blended by weight, scaled ×100. Grade thresholds: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, else F. The endpoint first runs the funding model so the funding-readiness pillar uses the real probability.

### 5.6 Risk Detection

**File:** `app/agents/ml/risk_detection.py` · **Endpoint:** `POST /api/risk`

**What it does.** Produces an **auditable risk register** across 5 categories — financial, customer, market, team, execution — each emitting concrete flags with severity and evidence, rolled up into a weighted 0–100 overall score.

**How it works.** Fully deterministic and config-driven (`failure_thresholds` + `risk_detection`). Each category function scans the founder's numbers and emits flags such as:
- **Financial:** critical/low/warning runway tiers; unsustainable burn multiple; pre-revenue burn.
- **Customer:** critical/high churn; shrinking base; "leaky bucket" (churn outpaces growth).
- **Market:** stretched valuation (>N× revenue); eight-figure valuation with zero revenue.
- **Team:** team too thin for a funded stage; solo operation at a funded stage.
- **Execution:** stage stagnation (old but still early), no traction after years, plus signals from the trained failure/funding models when available.

Each flag has a severity (`low/medium/high/critical` → numeric); a category score is `top_severity + 8 × (extra_flags)` capped at 100; the overall is a weighted sum (`financial 0.35`, `customer 0.25`, `market 0.15`, `team 0.10`, `execution 0.15`). The API enriches it with trained-model probabilities when they're computable, but the register **still works from raw metrics alone** if the models error.

**Concept.** A "risk register" is an explainable, severity-ranked list — the opposite of a black box; every flag cites its evidence dict.

### 5.7 Data Validation

**File:** `app/agents/data_validation.py` · used by `POST /api/upload`

**What it does.** Scores the quality of an uploaded dataset (0–100) and reports missing fields, duplicates, and outliers.

**How it works.** For each numeric column it counts outliers via **IQR** (Q1/Q3 ± multiplier·IQR), **Z-score** (|z| > threshold), and — if scikit-learn is present and there are ≥8 rows — **Isolation Forest** (contamination configurable). Quality score multiplicatively penalizes missingness, duplicate ratio, and outlier ratio. Thresholds live in `config.json → outlier_detection`.

**Concepts.** **IQR** = spread of the middle 50%; **Z-score** = standard deviations from the mean; **Isolation Forest** isolates anomalies via random splits (few splits to isolate ⇒ outlier). Combining three methods is more robust than any one.

---

## 6. LLM reasoning agents

**File:** `app/agents/intelligence/agents.py` (+ `startup_understanding.py`). Each is a thin wrapper: render a prompt from `prompts.yaml`, call `llm.complete()`, return parsed JSON. **There is no mock substitute** — if the LLM is unconfigured or fails, the error surfaces in the UI. Every prompt mandates strict JSON in a fixed schema.

### 6.1 Startup Understanding
**Endpoint:** `POST /api/understand`. Classifies `industry`, `business_model`, `stage`, and a growth `profile` (`high-growth` / `steady` / `struggling` / `early-stage`). Used to enrich context for the other agents.

### 6.2 Root Cause Analysis
Consumes the failure model's feature importances (SHAP-style) + metrics and returns human-readable `causes` with `impact` and `evidence` — turning numbers into narrative "why."

### 6.3 Founder Strategy
**Endpoint:** `POST /api/strategy`. Returns prioritized `recommendations` across product / growth / feature areas.

### 6.4 Investor (VC)
Returns `would_invest` (bool), `confidence` (0–1), `thesis`, and `concerns[]` — a VC partner's verdict.

### 6.5 Financial Risk (CFO)
Returns `runway_months`, `risk_level`, and a `recommendation` from a CFO's lens.

### 6.6 Competitor Intelligence
**Endpoint:** `POST /api/competitor`. Returns `threat_score` (0–100), `competitive_gap[]`, and a `summary`.

### 6.7 Market Opportunity
**Endpoint:** `POST /api/market`. Returns `opportunity_score` (0–100), `recommended_market`, and `trends[]`.

> Note: the competitor/market/strategy endpoints pass questionnaire metrics straight to the agent (industry/model/stage already known), skipping an extra `understand()` round-trip to halve latency.

---

## 7. The Debate Engine

**File:** `app/agents/debate_engine.py` · **Endpoints:** `POST /api/debate` (blocking), `POST /api/debate/stream` (SSE)

**What it does.** Six personas — **Founder, Investor, Financial, Customer, Market, Competitor** — argue across **three rounds**, then a consensus is tallied.

**How it works.**
- **Round 1:** each agent gives an independent opinion (`debate_round_1` prompt).
- **Round 2:** each agent challenges/builds on the others, fed the prior round's transcript (`debate_round_2`).
- **Round 3:** each moves toward consensus with a `final_recommendation` (`debate_round_3`).
- Each turn returns `{role, message, stance}` where `stance ∈ {bullish, neutral, bearish}`.
- **Consensus** = the majority stance among round-3 messages.
- It's implemented as a **LangGraph `StateGraph`** when `langgraph` is installed, else an equivalent sequential orchestration (`_HAS_LANGGRAPH` flag).
- **Resilience:** one agent failing yields an `agent_skipped` event and the debate continues — a transient upstream error can't abort the boardroom.
- The function is a **generator** that yields events (`start`, `round_start`, `message`, `round_end`, `consensus`), so the API layer can stream them.

**Streaming endpoint** (`debate.py`): wraps the generator in an async SSE response with a 0.35 s pacing delay between events so the UI animates message-by-message; the full transcript is persisted to the `debates` table.

**Concept.** This is a genuine **multi-agent system** — many specialized agents interacting — not a single prompt. 6 personas × 3 rounds = up to 18 live model calls.

---

## 8. The Board (Chairperson) & full pipeline

**File:** `app/agents/board.py` · **Endpoints:** `POST /api/board` (blocking), `POST /api/board/stream` (SSE)

**What it does.** Runs **every** agent, then a Chairperson LLM synthesizes one executive decision.

**How it works.**
1. **`gather_all`** runs all agents, each wrapped in a `safe()` helper so one failure degrades gracefully (`{error, degraded: true}`) instead of breaking the board: understanding → failure → forecast → funding → sentiment → health → risk → root_cause → founder_strategy → investor → financial_risk → competitor → market → debate → pivots.
2. **`_compact`** trims the aggregate to just the signal the Chair needs (keeps the prompt small): health score, failure_12m, funding probability, risk level + top risks, forecast, sentiment, root causes, founder actions, investor verdict, CFO summary, competitor threat, market opportunity, debate consensus, recommended pivot.
3. **`board_decision`** sends that compact view through the `board_decision` prompt; the Chairperson returns:
   - `board_decision ∈ {INVEST, HOLD, PIVOT, WIND_DOWN}`,
   - `confidence`, `strategic_actions[]`, `growth_roadmap[]`, `risk_mitigation[]`, `funding_strategy`, `summary`.
4. Returns `{board_decision_obj, full_report}`.

**The streaming pipeline** (`app/api/routes/pipeline.py`) is the showpiece: a registry of 15 `STEPS` (each tagged `ml` or `llm`). For each step it emits `agent_start`, runs the work, then `agent_done` (with real elapsed `ms` and the result) or `agent_error`. The debate streams each message as `debate_message`. A final `complete` event carries the whole report + decision. This is what powers the live "watch the agents work" UI.

---

## 9. Digital Twin & Scenario Simulation

**File:** `app/simulation/digital_twin.py` · **Endpoint:** `POST /api/simulate`

**What it does.** Answers "what if?" — applies a scenario to a virtual copy of the company and shows both the state change **and** the predicted impact on the trained models.

**Scenarios** (`config.json → simulation_multipliers`): `marketing_increase`, `hiring_increase`, `product_launch`, `cost_cutting` — each a set of percentage deltas on revenue / burn / growth / expenses.

**How it works.**
1. `build_state` snapshots the company (revenue, customers, funding, burn, expenses, growth, market share).
2. `apply_scenario` applies the multipliers to that state and re-derives customers and runway.
3. `apply_scenario_to_metrics` applies the same deltas to the **full metrics dict** so the trained failure/funding/health models can be **re-run on the simulated company** — the genuinely interesting part.
4. The endpoint computes `predicted_impact`: before vs. after for `failure_12m`, `health_score`, and `funding_probability`, plus a field-by-field `diff` (absolute + percent change).

**Concept.** A "digital twin" is a live model of the real entity you can experiment on safely; here the experiment's effect is measured by re-scoring the ML models, not by guesswork.

---

## 10. Pivot Engine

**File:** `app/simulation/pivot.py` · **Endpoint:** `POST /api/pivots`

**What it does.** Proposes alternative business directions and ranks them.

**How it works.**
1. **Generation (LLM):** the `pivot_generation` prompt makes the model propose **≥3** distinct pivots, each with its own estimates: `revenue_impact`, `risk_reduction`, `customer_growth`, `funding_probability` (all 0–1). Raises if it returns none.
2. **Optimization (rule-based):** `optimize` scores each pivot with config weights (`pivot_scoring`: revenue 0.30, risk reduction 0.25, customer growth 0.25, funding 0.20) and derives:
   - `success_probability = min(0.97, 0.4 + score)`,
   - `risk_score = max(0.03, 1 − risk_reduction) × 100`,
   - `roi = revenue_impact × 100 − risk_penalty`.
3. Sorts descending and returns the `recommended_pivot` plus the full ranked list.

**Concept — division of labor.** The LLM supplies *creativity and estimates*; a transparent, tunable scorer supplies *ranking math*. Top pivots are persisted to `pivot_results`.

---

## 11. The LLM resilience layer

**File:** `app/core/llm.py`. Every reasoning agent goes through `llm.complete()`.

**What it does.** Calls a real model through the configured OpenAI-compatible provider and returns parsed JSON — resilient to flaky free tiers, but never faking output.

**Key mechanics.**
- **Provider abstraction** (`_provider`): chosen by `LLM_PROVIDER` env or `config.json → llm.provider`.
  - **Featherless** — single configured model (default `google/gemma-4-31B-it`), no `response_format` (parsed tolerantly).
  - **OpenRouter** — supports `json_object` mode and a free-model **fallback chain**.
  - If the provider key is missing, it raises `LLMError` (e.g. `"FEATHERLESS_API_KEY is not configured"`).
- **Model-fallback chain** (`_model_chain`, OpenRouter only): primary model → known-good free models (`gpt-oss-20b`, `gpt-oss-120b`, `llama-3.3-70b`, `qwen3`, `glm-4.5-air`). On 404/429/5xx, the next model is tried **immediately** (no wasted retries). Every candidate is a real LLM — resilience, not a mock.
- **Last-good memory** (`_last_good`): once a model succeeds it's tried first next time, avoiding re-paying a saturated primary.
- **Self-throttle** (`_throttle`): a token-bucket deque limits ~18 requests/min (`LLM_RPM`) so fan-out board/debate runs respect rate limits — real work, real time.
- **Bounded attempts + 45 s timeout:** at most 6 attempts across two passes of the chain, so one logical call can't thrash for minutes.
- **Tolerant JSON extraction** (`_extract_json`): strips code fences, falls back to a `{...}` regex; malformed JSON triggers a retry; total failure raises `LLMError`.

**Concept.** Free LLM tiers are unreliable, so the client is engineered to **degrade to a real error visibly** rather than silently invent numbers — central to the project's "nothing is fabricated" promise.

---

## 12. Config-driven architecture (hot reload)

**Files:** `app/core/config.py`, `app/config/config.json`, `app/config/prompts.yaml` · **Endpoints:** `GET/PUT /api/config`, `GET /api/status`

**What it does.** Keeps scoring weights, thresholds, taxonomies, multipliers, the LLM block, and **every prompt** out of code, editable live.

**How it works.**
- `config.json` holds `health_weights`/`health_norms`, `industries`, `business_models`, `stages`, `simulation_multipliers`, `pivot_scoring`, `outlier_detection`, `failure_thresholds`/`failure_adjustment`/`failure_horizons`, `funding_adjustment`, `risk_detection`, and the `llm` block.
- `prompts.yaml` holds the system prompt and one prompt per agent.
- With `VG_HOT_RELOAD=true` (default), both files are **re-read on every access**, so edits apply with no restart.
- `render_prompt(name, **kwargs)` substitutes `{placeholders}` without tripping on literal JSON braces in the template.
- `GET /api/config` returns the live config + LLM mode; `PUT /api/config` shallow-merges a patch and writes it back.

**Why it matters.** Tuning scoring or prompts is a config edit, not a code change — and the `industries` list is the single source of truth shared by the questionnaire and the model's industry encoding.

---

## 13. Data persistence layer

**Files:** `app/db/database.py`, `app/db/models.py`

**What it does.** Persists users, startups, predictions, forecasts, debate transcripts, and pivots.

**Schema (SQLAlchemy):**
- **`users`** — mirror of a Clerk user (clerk_id, email, name, image), kept in sync by the webhook.
- **`startups`** — the full questionnaire profile + `status`.
- **`predictions`** — failure_probability, funding_probability, health_score (FK → startup).
- **`forecasts`** — forecast_3m/6m/12m.
- **`debates`** — agent_name, round, message, stance.
- **`pivot_results`** — pivot_name, success_probability, roi, risk_score.

**Resilience.** `_make_engine()` connects to PostgreSQL with a short 2 s connect timeout and `pool_pre_ping`; if Postgres is unreachable it **auto-falls back to SQLite** (treated as an intentional mode, logged at info level). `init_db()` creates all tables on startup.

---

## 14. CSV upload & ingestion

**File:** `app/api/routes/upload.py` · **Endpoint:** `POST /api/upload`

**What it does.** Lets you import companies from a CSV (e.g. the bundled YC/Failory datasets), validate them, and get an LLM understanding of a sample.

**How it works.**
1. Reads the CSV with pandas; rejects non-`.csv`.
2. Runs **Data Validation** (§5.7) on the raw frame.
3. Normalizes columns via a `COLUMN_ALIASES` map (handles `company_name`/`name`, `total_funding`, `current_employees`/`team_size`, etc.).
4. `_clean_money` parses messy money strings (`$`, commas, `K`/`M`/`B` suffixes) into floats.
5. Inserts up to 500 rows as `Startup` records, then runs **Startup Understanding** on the first row.
6. Returns validation, rows imported, a sample startup, the understanding, and the new ids.

Also exposes `POST /api/startups` (create), `GET /api/startups` (list), `GET /api/startups/{id}`.

---

## 15. Authentication (Clerk) & webhooks

**Files:** `frontend/app/layout.tsx`, `sign-in`/`sign-up`/`sso-callback` pages, `app/api/routes/webhooks.py`

**What it does.** Adds user authentication (Clerk) and keeps a server-side mirror of users in sync.

**Frontend.** `ClerkProvider` wraps the app with a dark-themed appearance; `sign-in`, `sign-up`, and `sso-callback` are full-bleed public routes (no nav chrome / profile gate — see `Chrome.tsx`).

**Webhook receiver** (`/api/webhooks/clerk`).
- **Signature-verified every request.** Primary path uses the official **`svix`** library; if `svix` isn't installed it **falls back to a stdlib HMAC-SHA256** check that replicates the Svix scheme (timestamp tolerance, base64 secret, `v1,<sig>` token list) — mirroring the project's documented-fallback convention.
- Handles `user.created` / `user.updated` (upsert into `users`, picking the primary email) and `user.deleted` (remove the row); other events are acknowledged.
- Refuses to run if `CLERK_WEBHOOK_SIGNING_SECRET` is unset (surfaces the misconfiguration rather than accepting spoofed events).

---

## 16. The frontend

**Framework.** Next.js 14 App Router, React 18, TypeScript, Tailwind. `reactStrictMode` is deliberately **off** so effects don't double-fire the expensive agent calls in dev.

**Pages** (`frontend/app/`): landing (`/`), `onboarding`, `launching`, `dashboard`, and one page per agent — `health`, `failure`, `forecast`, `funding`, `customer`, `competitor`, `market`, `pivots`, `simulation`, `board`, `report` — plus `sign-in`/`sign-up`/`sso-callback`.

**State — `lib/store.tsx` (`StoreProvider`).** Holds the founder profile, reviews, a per-page result `cache`, and the shared `board` pipeline state, all hydrated from `localStorage`. Its key method, **`prewarm()`**, runs the full board stream once and **fans results out into the cache** so every downstream page renders instantly instead of re-running its own agents. Editing the profile resets all cached analysis.

**API client — `lib/api.ts`.** Typed wrappers over every endpoint plus a generic **SSE consumer** (`streamSSE`) used by `streamDebate` and `streamBoard`. Calls go **directly to the backend** (CORS) so long agent requests aren't killed by the dev proxy's idle-socket timeout.

**Components.**
- **`AgentPipeline.tsx`** — renders each agent pending → running (pulsing amber spinner) → done (✓ + real duration) or error (✗), with an `LLM`/`MODEL` pill per step and an overall progress bar.
- **`Chrome.tsx`** — chooses full-bleed (landing/auth) vs. the app shell (`TopNav` + `ProfileGuard`).
- **`ProfileGuard`** — gates app pages behind a completed questionnaire.
- **`LottieLoader` / `FluidCanvas` / `instrument.tsx`** — the loading animation, a three.js fluid landing canvas, and bespoke SVG instrument glyphs.

**Design language — "Kinetic Instrument."** Matte near-black ground; fixed-meaning signal hues (lime = good, aqua = steady, violet = compute/LLM, coral = risk, amber = running); huge condensed count-up display numbers (Big Shoulders) with JetBrains Mono "specimen" labels; Recharts gauges/SHAP bars/forecast areas/sentiment donut from a shared chart theme.

**Launching screen** (`app/launching/page.tsx`). Starts `prewarm()` exactly once, cycles friendly status copy, shows the live `AgentPipeline`, and eases into the dashboard when complete (or offers Retry / "Continue anyway" on failure, since pages can still run agents on demand).

---

## 17. Streaming (SSE) infrastructure

**What it does.** Pushes live progress from backend to browser over one HTTP connection so users watch real work happen.

**How it works.** Backend endpoints return a FastAPI `StreamingResponse` of `text/event-stream` with `Cache-Control: no-cache` and `X-Accel-Buffering: no`; each event is serialized as `data: {json}\n\n`. The frontend `streamSSE` reads the response body with a `TextDecoder`, splits on `\n\n`, and dispatches parsed events. Two streams exist: the **debate** (`/api/debate/stream`, paced 0.35 s/event) and the **full board pipeline** (`/api/board/stream`, emitting per-agent start/done/error + debate messages + final report).

**Concept.** **SSE** (Server-Sent Events) is a lightweight one-way server→client stream — simpler than WebSockets and ideal for progress feeds. Because the LLM work is genuinely live, the elapsed times shown are real.

---

## 18. API surface

All analysis endpoints accept either `{ "startup_id": <id> }` or `{ "metrics": {…} }` (+ optional `customer_reviews`, `revenue_series`).

| Endpoint | Kind | Purpose |
|---|---|---|
| `POST /api/upload` | data | CSV import + validation + understanding |
| `POST /api/startups` · `GET /api/startups` · `GET /api/startups/{id}` | data | Create / list / fetch startups |
| `POST /api/understand` | LLM | Classify industry / model / stage / profile |
| `POST /api/failure` | ML | Failure probability 6/12/24m + SHAP |
| `POST /api/forecast` | ML | Revenue forecast 3/6/12m + series |
| `POST /api/funding` | ML | Funding probability + investor score |
| `POST /api/customer` | ML | Customer sentiment |
| `POST /api/health` | ML | Weighted health score |
| `POST /api/risk` | ML | Deterministic risk register |
| `POST /api/competitor` · `…/market` · `…/strategy` | LLM | Intelligence agents |
| `POST /api/simulate` | sim | Digital-twin scenario + predicted impact |
| `POST /api/pivots` | LLM+rule | Pivot generation → scoring |
| `POST /api/debate` · `POST /api/debate/stream` | LLM | Boardroom debate (blocking / SSE) |
| `POST /api/board` · `POST /api/board/stream` | all | Full pipeline → verdict (blocking / SSE) |
| `GET/PUT /api/config` · `GET /api/status` | system | Config & health |
| `POST /api/webhooks/clerk` | auth | Clerk user-sync webhook |

---

## 19. Concept glossary

- **Agent** — one specialized worker (model or LLM) with one job and a fixed JSON output schema. There are ~16.
- **ML model** — a trained "calculator" mapping inputs to a probability. Here: two gradient-boosted classifiers.
- **Gradient boosting** — many small decision trees built in sequence, each fixing the last's mistakes; strong on tabular data.
- **Calibration (isotonic)** — adjusts raw scores so a "70%" really means ~70%.
- **Target encoding** — replaces a category with a cross-fitted estimate of its outcome rate (leakage-safe).
- **AUC** — 0.5 random … 1.0 perfect; measured on a holdout the model never saw. **Brier** — probability MSE (lower better).
- **SHAP** — fairly attributes a single prediction across its features (game-theoretic Shapley values).
- **Prophet** — additive time-series forecaster (used for revenue when installed).
- **FinBERT** — BERT fine-tuned for financial-text sentiment.
- **Isolation Forest / IQR / Z-score** — three complementary outlier detectors used in data validation.
- **LLM** — a large language model; powers the reasoning agents that produce opinions in words.
- **Multi-agent system** — many agents interacting (and here, debating), not one prompt.
- **SSE** — Server-Sent Events; a one-way live stream from server to browser.
- **Digital twin** — a manipulable virtual model of the real company, used for what-if simulation.
- **Runway** — months of cash left = `cash ÷ monthly burn`. **Churn** — % customers lost per month. **Burn ratio** — `(expenses − revenue) / (expenses + 1)`.
- **Board verdict** — the final aggregated call: **INVEST / HOLD / PIVOT / WIND_DOWN**.

---

### Design constraints honored across all features

- ✅ All agent outputs are consistent JSON; the frontend degrades gracefully if any single agent fails.
- ✅ Every ML agent keeps a documented rule-based fallback; LLM agents surface errors instead of faking output.
- ✅ No hardcoded demo metrics — all input flows through `resolve_metrics()`.
- ✅ Scoring weights and prompts live in `config.json` / `prompts.yaml`, hot-reloaded.
- ✅ Long multi-agent runs stream over SSE so the work is observable and the elapsed times are real.
- ✅ Postgres with automatic SQLite fallback; LLM provider with a model-fallback chain.
