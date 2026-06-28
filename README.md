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
- **Digital Twin** — Monte Carlo engine for stress-testing pivots and runway scenarios
- **Executive report** — one-click board memo synthesizing all outputs

## Tech Stack

**Frontend** — Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Three.js

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

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm install && npm run dev
```

Set `ANTHROPIC_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `DATABASE_URL` in your environment.
