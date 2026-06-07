"""Seed script (Phase 11): import REAL YC companies into the DB for browsing/reference.

No fabricated startups and no random metrics — only fields that genuinely exist in the
bundled YC dataset are imported. Operating financials (revenue/burn/etc.) are left at 0
because the public dataset does not contain them; the founder supplies those via the
onboarding questionnaire.

Run:  python seed.py            # imports a sample of real YC companies
      python seed.py --all      # imports the full dataset
"""
from __future__ import annotations

import os
import sys
import datetime as dt

import pandas as pd

from app.db.database import SessionLocal, init_db
from app.db import models

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _year_from_unix(ts):
    try:
        return dt.datetime.utcfromtimestamp(float(ts)).year
    except Exception:
        return None


def seed_from_yc(db, limit):
    path = os.path.join(DATA_DIR, "yc_companies_algolia.csv")
    if not os.path.exists(path):
        print("No YC dataset found; nothing to seed.")
        return 0
    df = pd.read_csv(path)
    if limit:
        df = df.head(limit)
    count = 0
    for _, r in df.iterrows():
        team = r.get("team_size")
        db.add(models.Startup(
            startup_name=str(r.get("name", "Unnamed")),
            industry=None if pd.isna(r.get("industry")) else str(r.get("industry")),
            business_model=None,
            stage=None if pd.isna(r.get("stage")) else str(r.get("stage")),
            founding_year=_year_from_unix(r.get("launched_at")),
            employee_count=int(team) if pd.notna(team) else 0,
            status=None if pd.isna(r.get("status")) else str(r.get("status")),
        ))
        count += 1
    db.commit()
    return count


def main():
    init_db()
    db = SessionLocal()
    try:
        if db.query(models.Startup).count() > 0:
            print("DB already populated; skipping.")
            return
        limit = None if "--all" in sys.argv else 60
        n = seed_from_yc(db, limit)
        print(f"Imported {n} real YC companies (reference data, no fabricated metrics).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
