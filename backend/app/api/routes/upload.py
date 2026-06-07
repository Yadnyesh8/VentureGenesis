"""CSV upload + startup CRUD (Phase 3)."""
from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents.data_validation import validate_dataframe
from app.agents.startup_understanding import understand
from app.db import models
from app.db.database import get_db
from app.db.schemas import StartupCreate, StartupOut

router = APIRouter()

# Map common dataset columns to our schema (handles the bundled YC/Failory CSVs).
COLUMN_ALIASES = {
    "company_name": "startup_name", "name": "startup_name", "startup_name": "startup_name",
    "Industry": "industry", "industry": "industry",
    "total_funding": "funding_amount", "funding": "funding_amount", "funding_amount": "funding_amount",
    "valuation": "valuation",
    "current_employees": "employee_count", "team_size": "employee_count", "employee_count": "employee_count",
    "status": "status",
    "revenue": "revenue", "expenses": "expenses", "burn_rate": "burn_rate",
    "runway": "runway", "customer_count": "customer_count", "customer_growth": "customer_growth",
    "churn_rate": "churn_rate", "stage": "stage",
}

NUMERIC = {"revenue", "expenses", "burn_rate", "runway", "customer_count", "customer_growth",
           "churn_rate", "funding_amount", "employee_count", "valuation"}


def _clean_money(v):
    if pd.isna(v):
        return 0.0
    if isinstance(v, str):
        v = v.replace("$", "").replace(",", "").strip()
        mult = 1
        if v.endswith("M"):
            mult, v = 1_000_000, v[:-1]
        elif v.endswith("B"):
            mult, v = 1_000_000_000, v[:-1]
        elif v.endswith("K"):
            mult, v = 1_000, v[:-1]
        try:
            return float(v) * mult
        except ValueError:
            return 0.0
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0.0


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file")
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(400, f"Could not parse CSV: {exc}")

    validation = validate_dataframe(df)

    # Normalize columns
    renamed = {c: COLUMN_ALIASES[c] for c in df.columns if c in COLUMN_ALIASES}
    ndf = df.rename(columns=renamed)

    created = []
    for _, row in ndf.head(500).iterrows():
        data = {}
        for col in models.Startup.__table__.columns.keys():
            if col in ("id", "created_at") or col not in ndf.columns:
                continue
            val = row.get(col)
            if col in NUMERIC:
                data[col] = _clean_money(val)
            elif col == "customer_count" or col == "employee_count":
                data[col] = int(_clean_money(val))
            else:
                data[col] = None if pd.isna(val) else str(val)
        if not data.get("startup_name"):
            data["startup_name"] = "Unnamed"
        startup = models.Startup(**{k: v for k, v in data.items() if v is not None})
        db.add(startup)
        created.append(startup)
    db.commit()
    for s in created:
        db.refresh(s)

    sample = created[0].to_dict() if created else {}
    understanding = understand(sample) if sample else {}

    return {
        "ok": True,
        "validation": validation,
        "rows_imported": len(created),
        "sample_startup": sample,
        "understanding": understanding,
        "startup_ids": [s.id for s in created[:50]],
    }


@router.post("/startups", response_model=StartupOut)
def create_startup(payload: StartupCreate, db: Session = Depends(get_db)):
    startup = models.Startup(**payload.model_dump())
    db.add(startup)
    db.commit()
    db.refresh(startup)
    return startup


@router.get("/startups")
def list_startups(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.query(models.Startup).order_by(models.Startup.id.desc()).limit(limit).all()
    return {"count": len(rows), "startups": [r.to_dict() for r in rows]}


@router.get("/startups/{startup_id}", response_model=StartupOut)
def get_startup(startup_id: int, db: Session = Depends(get_db)):
    row = db.get(models.Startup, startup_id)
    if not row:
        raise HTTPException(404, "Startup not found")
    return row
