# SPEC — Frontier Agents Implementation Plan

A phase-wise implementation spec for four new capabilities on top of the existing
VENTUREGENESIS agent platform:

1. **Multi-Agent Epistemic Uncertainty Resolution (VOI)** — debate agents compute the
   Value of Information for missing data and call external sources only when `VOI > Cost`.
2. **AGI Pre-Conditioner** — stress-tests the business model against AGI milestones and
   scores AGI-resistance.
3. **Corporate Spin-out Viability Engine** — predicts whether an internal R&D project
   wins as an independent VC-backed startup vs. an internal business unit.
4. **Causal Trajectory Mapping** — maps the causal cascade from a current KPI drop to
   startup death, with intervention points.

> This plan deliberately reuses the platform's existing conventions (see `CLAUDE.md`):
> universal `resolve_metrics()` entry, ML/stat agents with **documented rule-based
> fallbacks**, LLM reasoning agents that **surface errors** (no mock), **config-driven**
> weights (`config.json`) and prompts (`prompts.yaml`) with hot reload, SSE for long
> runs, one frontend page per agent driven by `lib/store.tsx` + `lib/api.ts`, and
> graceful per-agent degradation in `board.gather_all`.

---

## Guiding constraints (apply to every phase)

- **No fabricated numbers.** Every output traces to founder input, a trained model, a
  config-driven formula, or a cited external fetch. Missing input → documented fallback.
- **ML/stat agents keep a rule-based fallback; LLM agents raise `LLMError`.** New
  deterministic engines (VOI math, causal DAG, spin-out scoring) follow the ML pattern:
  primary path uses an optional library, fallback uses a transparent formula.
- **Tune via config, not code.** New scoring weights go in `config.json`; new prompts go
  in `prompts.yaml`. Both hot-reload.
- **Everything routes through `resolve_metrics()`** (extend the schema, don't bypass it).
- **Board integration is additive.** New agents register inside `board.gather_all` via the
  existing `safe(...)` wrapper so one failure can't break the board.

---

## Phase 0 — Shared foundations (prerequisite for all four)

Goal: land the cross-cutting plumbing once so each feature phase is small and isolated.

### 0.1 External Knowledge Connector layer (`app/core/knowledge.py`) — NEW
A thin, provider-agnostic fetch layer the VOI engine (and later, agents) call to acquire
missing facts. Mirrors `llm.py` design: single entrypoint, self-throttle, typed errors.

- `fetch(source: str, query: str) -> KnowledgeResult` where `source ∈ {web_search,
  market_data, competitor_db, internal}`.
- Each source has an adapter; **each adapter has a documented offline fallback** (returns
  `{available: False, reason}` instead of raising) so the platform runs with no keys.
- Per-source **cost + latency metadata** read from `config.json → knowledge_sources`
  (e.g. `{web_search: {usd_cost: 0.004, latency_ms: 1500, reliability: 0.7}}`). This is
  the `Cost` term Feature 1 compares VOI against.
- Caches results per `(source, query)` for the lifetime of a board run to avoid double-pay.

### 0.2 Config blocks (`app/config/config.json`)
Add (empty-but-typed) top-level keys so later phases only edit values:
- `knowledge_sources` (costs/latency/reliability per source)
- `voi` (decision-value weights, fetch threshold margin, max fetches per run)
- `agi_preconditioner` (threat-vector weights, milestone horizons)
- `spinout` (Innovator's-Dilemma factor weights, VC-vs-BU value params)
- `causal` (edge priors, KPI→death template graph, time-to-event params)

### 0.3 Schema + persistence
- `app/db/schemas.py`: extend `StartupBase`/add request models — `SpinoutRequest`
  (project fields), `AGIRequest`, `CausalRequest`, `VOIRequest`. Keep the
  `{startup_id} | {metrics}` duality via `StartupRef` subclassing.
- `app/db/models.py`: add result tables following the `PivotResult` pattern —
  `VOIDecision`, `AGIAssessment`, `SpinoutAssessment`, `CausalTrajectory`. (SQLite
  auto-fallback already handled by `database.py`; no Postgres-only types.)

### 0.4 Frontend scaffolding
- `lib/api.ts`: add typed `post`/`streamSSE` wrappers for the four new endpoints.
- `lib/store.tsx`: extend the per-page result cache keys (the launching screen fans board
  output into these) so new pages render instantly when run as part of the board.
- Reusable result components in `components/ui.tsx` (callout, score bar, chain/step list).

**Exit criteria:** connector returns graceful "unavailable" with no keys; config keys load
& hot-reload; migrations apply on SQLite & Postgres; `pytest` green; frontend builds.

---

## Phase 1 — Multi-Agent Epistemic Uncertainty Resolution (VOI)

The flagship. Augments the debate so agents *quantify their own ignorance* and spend the
information budget rationally.

### 1.1 VOI engine (`app/agents/ml/voi.py`) — deterministic, with fallback
- **Identify gaps:** scan resolved metrics for missing/zero/low-confidence fields plus a
  config list of "decision-critical unknowns" (e.g. TAM, competitor funding, churn cohort).
- **Estimate sensitivity (the value term):** perturb each candidate field and re-run the
  cheap ML agents (`predict_failure`, `predict_funding`) to measure how much the board-
  relevant probability moves. `VOI(field) = decision_value × E[Δp | resolving field]`,
  where `decision_value` is a config weight for how much that probability swings the
  verdict. **Fallback** (no models): use config-prior elasticities per field.
- **Cost:** pull `usd_cost`/`latency`/`reliability` from `knowledge_sources` for the
  cheapest source that can answer the field (a `field → source` map in config).
- **Decision rule:** request a fetch iff `VOI > Cost × (1 + margin)` and total fetches
  `< voi.max_fetches_per_run`. Emit a ranked **information ledger** (field, VOI, cost,
  decision, source).

### 1.2 Debate integration (`app/agents/debate_engine.py`)
- Insert a **Round 0 — "uncertainty audit"** before the existing 3 rounds: each role may
  emit `information_requests` (a structured list) in addition to its message.
- Orchestrator dedupes requests → VOI engine scores → for `VOI > Cost` requests, calls
  `knowledge.fetch()` → injects results into the shared `context` so rounds 1–3 argue with
  the new facts. Keep the existing per-agent `try/except` so a failed fetch just degrades.
- New SSE event types: `uncertainty_audit`, `info_request`, `info_fetched`,
  `info_skipped_low_voi` — streamed through the existing `pipeline.board_stream` and the
  `AgentPipeline` animation.

### 1.3 Prompts & config
- `prompts.yaml`: `debate_round_0` (asks each role for its top unknowns and why they'd
  change its stance) and extend round prompts to reference fetched evidence.
- `config.json → voi`: decision-value weights, margin, max fetches; `field → source` map.

### 1.4 API, persistence, frontend
- Route: `POST /api/voi` (standalone ledger) in `analysis.py`; the audit also runs inside
  the board stream. Persist `VOIDecision` rows.
- Frontend `app/uncertainty/page.tsx`: the information ledger (what we knew, what was worth
  buying, what we bought, the stance shift it caused).

**Exit criteria:** with no external keys, engine still ranks gaps and reports
"unavailable, would have cost $X for VOI $Y"; with a key, a high-VOI field triggers exactly
one fetch and visibly shifts a stance; deterministic VOI math unit-tested.

---

## Phase 2 — AGI Pre-Conditioner

### 2.1 Engine (`app/agents/ml/agi_exposure.py` + `app/agents/intelligence/agi.py`)
- **Deterministic exposure scaffold (ML-style, with fallback):** score the business across
  config-driven **AGI threat vectors** — labor-arbitrage dependence, proprietary-data moat,
  distribution/network effects, regulatory shielding, human-trust premium, capital moat.
  Map founder's industry/business-model/metrics → per-vector exposure (0–1) → weighted
  **AGI-resistance score**. Fallback = pure config weights when no model.
- **LLM reasoning layer (raises on failure):** `agi.precondition(context)` narrates *how*
  the model breaks at each milestone and proposes AGI-resistant redesigns.

### 2.2 Milestone simulation
- Config `agi_preconditioner.milestones` (e.g. "expert-level white-collar automation",
  "autonomous agents w/ tool use", "self-improving research"). For each milestone, recompute
  which revenue lines / moats survive → a **survival curve** and a single
  "years-of-defensibility" estimate driven by config horizons + founder's moat inputs.

### 2.3 Prompts, API, frontend
- `prompts.yaml`: `agi_precondition` (per-milestone breakage + redesign), reusing
  `system_base`.
- Route `POST /api/agi` (`AGIRequest`); register in `board.gather_all` via `safe(...)`.
- Frontend `app/agi/page.tsx`: resistance gauge, per-vector breakdown, milestone survival
  timeline, redesign recommendations.

**Exit criteria:** resistance score computes from real industry/moat inputs with the
fallback weights; LLM layer surfaces a clear error when the key is missing; board includes
an `agi` block.

---

## Phase 3 — Corporate Spin-out Viability Engine

New input domain: an **internal R&D project** inside a parent company (not just a startup).

### 3.1 Input model
- `SpinoutRequest` (in `schemas.py`): project name, stage, capital intensity, strategic
  adjacency to parent, cannibalization risk, talent dependence, market disruption potential,
  parent's cost-of-capital — all founder/operator-suppliable; routed via a `resolve_*`
  helper (extend `resolve.py` or add `resolve_project`).

### 3.2 Engine (`app/agents/ml/spinout.py`) — deterministic, with fallback
- **Innovator's-Dilemma math:** compute two expected values:
  - `EV_internal` — value as a business unit (discounted by org drag, cannibalization
    avoidance, shared distribution).
  - `EV_spinout` — value as an independent VC-backed startup (upside from focus + external
    capital + equity incentives, discounted by loss of parent assets and higher failure
    base — reuse `predict_failure` for the standalone-startup failure base).
  - **Decision:** `spin out` iff `EV_spinout × P(survive_independent) >
    EV_internal × parent_capture` beyond a config margin. Weights in `config.json → spinout`.
  - **Fallback:** config-prior multipliers when the failure model is absent.
- Output: recommendation, the two EVs, the deciding factors, sensitivity (which one input
  flips the decision).

### 3.3 LLM narrative + API + frontend
- `app/agents/intelligence/spinout.py::rationale(context)` + `prompts.yaml: spinout`.
- Route `POST /api/spinout`; persist `SpinoutAssessment`. Optional board inclusion (only
  when project fields are present — guard in `gather_all`).
- Frontend `app/spinout/page.tsx`: EV comparison bars, decision verdict, flip-factor.

**Exit criteria:** EV math reproduces a known worked example in tests; recommendation flips
correctly when cannibalization / capital-intensity crosses thresholds; runs without LLM key
(deterministic part) and surfaces error for the narrative.

---

## Phase 4 — Causal Trajectory Mapping

### 4.1 Engine (`app/agents/ml/causal.py`) — deterministic, with fallback
- **Primary path:** build a causal DAG over KPIs and a terminal `death` node using an
  optional causal lib (`dowhy`/`causal-learn`) seeded with a config **template graph**
  (e.g. `churn↑ → revenue↓ → runway↓ → hiring_freeze → growth↓ → death`) plus edge priors.
- **Fallback (no lib):** evaluate the config template graph directly as a weighted
  propagation model — fully transparent, no library needed (this is the default the
  platform ships with).
- **Trajectory extraction:** given the founder's current KPI deltas, find the
  highest-probability path current-state → `death`, annotate each edge with conditional
  probability and **time-to-event** (config base rates × runway), and mark **intervention
  points** (edges with the largest controllable leverage).

### 4.2 LLM annotation, API, frontend
- `app/agents/intelligence/causal.py::narrate(path, metrics)` + `prompts.yaml: causal_trajectory`
  to translate the chain into a plain-language "this is how you die, and where to cut it."
- Route `POST /api/causal`; persist `CausalTrajectory`; register in `gather_all`.
- Frontend `app/trajectory/page.tsx`: a left-to-right cascade graph (reuse the pipeline
  visual idiom) with edge probabilities, ETAs, and highlighted intervention nodes.

### 4.3 Cross-feature link
- Expose the causal **edge sensitivities** to Phase 1's VOI engine: a field that sits on a
  high-probability death path gets a higher decision-value weight, so VOI prioritizes
  resolving the unknowns that most change the trajectory. (Wire this only after both phases
  pass independently.)

**Exit criteria:** with no causal lib installed, the template-graph fallback still produces
a ranked death path + interventions; the highest-leverage intervention matches the
worked-example test; board includes a `causal` block.

---

## Phase 5 — Board & pipeline integration

- Register `agi`, `spinout` (conditional), `causal` in `board.gather_all` via `safe(...)`;
  fold the VOI ledger into the debate already inside the board.
- Extend `board._compact` to feed the Chair the new signals (AGI-resistance, top death
  path + ETA, spin-out verdict, info-ledger summary) — keep the prompt small.
- Update `prompts.yaml: board_decision` to weigh AGI-resistance and the causal death path.
- Stream new step labels through `pipeline.board_stream` so `AgentPipeline` lights them up;
  add them to the launching-screen prefetch fan-out and the report generator.

**Exit criteria:** a full board run includes all four outputs, degrades gracefully if any
single one fails, and the downloadable report renders the new sections.

---

## Phase 6 — Hardening, docs, evaluation

- **Tests** (`backend/tests/`): unit tests for each deterministic engine (VOI math, EV
  math, causal propagation, AGI scoring) on worked examples; fallback-path tests with libs
  absent; route smoke tests; one board-integration test asserting graceful degradation.
- **Evaluation:** extend `app/ml_training/evaluate.py` notion to a calibration/sanity check
  for the new scorers where applicable (e.g. spin-out decision monotonicity).
- **Cost guardrails:** assert VOI never exceeds `max_fetches_per_run`; log total external
  spend per board run.
- **Docs:** add a section to `FEATURES.md`/`ARCHITECTURE.md`; update `CLAUDE.md` agent map.

---

## Sequencing & rationale

```
Phase 0 (foundations)
   │
   ├── Phase 1 VOI ───────────────┐  (builds the knowledge-connector everyone reuses)
   ├── Phase 2 AGI                 │
   ├── Phase 3 Spin-out           │  (1–4 are independent; can parallelize after Phase 0)
   └── Phase 4 Causal ──links──> 1 │  (causal sensitivities sharpen VOI; wire last)
                                   │
   Phase 5 (board integration) <──┘
   Phase 6 (hardening / docs)
```

- **Phase 0 first** because the connector layer, config blocks, schemas, and DB tables are
  shared. Do not start feature phases until 0's exit criteria pass.
- **Phase 1 before/with the others** since it introduces the external-fetch infrastructure
  and the VOI primitive; Causal (Phase 4) feeds back into it, so finish 1 and 4
  independently, then connect (4.3).
- **Phases 2 & 3 are fully parallelizable** — independent inputs, independent engines.
- **Phase 5 last among features** — integration only makes sense once each agent emits
  stable JSON.

## Effort sketch (relative)

| Phase | Backend | Frontend | Risk driver |
|------|---------|----------|-------------|
| 0 Foundations | M | S | connector design, migrations |
| 1 VOI | L | M | sensitivity estimation correctness, fetch cost control |
| 2 AGI | M | S | mostly prompt/config; LLM dependence |
| 3 Spin-out | M | S | EV model validity, new input domain |
| 4 Causal | L | M | DAG correctness, optional-lib fallback parity |
| 5 Integration | S | M | prompt-size budget, report rendering |
| 6 Hardening | M | — | test coverage of fallbacks |
