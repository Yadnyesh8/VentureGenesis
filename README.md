# VentureGenesis

AI-native startup intelligence platform that gives founders a virtual board of directors — turning raw metrics into predictive scores, revenue forecasts, and live strategic advice in seconds.

## What it does

Enter your startup metrics once and instantly get:

- **Failure prediction** — XGBoost model (trained on 6,089 YC companies) with 12-month failure probability + SHAP explanations
- **Revenue forecast** — Facebook Prophet time-series projection
- **Funding readiness** — calibrated ML classifier scoring investor-readiness
- **Health score** — composite signal across burn, churn, growth, and funding
- **Board debate** — multi-agent LLM pipeline (Chairperson, Investor, Strategist, Risk Analyst, Competitor Scout) delivers a structured board decision
- **AGI Pre-Conditioner** — scores disruption exposure across AGI milestones and proposes AGI-resistant redesigns
- **Digital Twin** — Monte Carlo engine for stress-testing burn and runway scenarios
- **Executive report** — one-click board memo synthesizing all outputs

## Tech Stack

**Frontend** — Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Three.js

**Backend** — Python, FastAPI, SQLAlchemy, PostgreSQL

**ML / Forecasting** — scikit-learn, XGBoost, LightGBM, CatBoost, Facebook Prophet, SHAP

**LLM / Agents** — Anthropic Claude, OpenRouter, LangChain, LangGraph

**Auth** — Clerk (Google OAuth + email/password)

**Infrastructure** — Redis, Uvicorn, SQLite fallback

## User Flow

3 clicks from landing to live board:

1. Sign up / sign in (Google OAuth = 1 click)
2. Fill startup profile — 3 required fields, everything else optional
3. Launch board

## Running locally

One-time setup — creates the backend virtualenv and installs both dependency sets:

```bash
npm run setup
```

Then run the whole stack with a single command:

```bash
npm run dev
```

That starts the FastAPI backend on **:8000** and the Next.js frontend on **:3000**,
with each side's output labelled. Stopping one stops the other.

Run a side on its own with `npm run dev:backend` or `npm run dev:frontend`.

### Environment

Copy `.env.example` to `.env` for the backend. The reasoning agents need
`OPENROUTER_API_KEY`; `DATABASE_URL` is optional and falls back to SQLite.

Clerk keys go in `frontend/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```
