"""VENTUREGENESIS FastAPI application (Phase 1)."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import init_db
from app.api.routes import analysis, debate, pipeline, system, upload

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="VENTUREGENESIS API",
    description="AI-native Startup Operating System — virtual board of directors.",
    version="1.0.0",
)

# Phase 1: CORS between frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/")
def root():
    return {"service": "VENTUREGENESIS", "docs": "/docs", "status": "ok"}


# Routers (all mounted under /api)
app.include_router(system.router, prefix=settings.API_V1, tags=["system"])
app.include_router(upload.router, prefix=settings.API_V1, tags=["data"])
app.include_router(analysis.router, prefix=settings.API_V1, tags=["agents"])
app.include_router(debate.router, prefix=settings.API_V1, tags=["debate"])
app.include_router(pipeline.router, prefix=settings.API_V1, tags=["pipeline"])
