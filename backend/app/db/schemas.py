"""Pydantic schemas for request/response bodies."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class StartupBase(BaseModel):
    startup_name: str = "Untitled Startup"
    industry: Optional[str] = None
    business_model: Optional[str] = None
    stage: Optional[str] = None
    founding_year: Optional[int] = None
    revenue: float = 0.0
    expenses: float = 0.0
    burn_rate: float = 0.0
    runway: float = 0.0
    customer_count: int = 0
    customer_growth: float = 0.0
    churn_rate: float = 0.0
    funding_amount: float = 0.0
    employee_count: int = 0
    valuation: float = 0.0
    status: str = "Active"


class StartupCreate(StartupBase):
    pass


class StartupOut(StartupBase):
    id: int

    class Config:
        from_attributes = True


class StartupRef(BaseModel):
    """Either reference an existing startup by id, or pass metrics inline."""

    startup_id: Optional[int] = None
    metrics: Optional[StartupBase] = None
    # Optional extra context for LLM agents.
    description: Optional[str] = None
    customer_reviews: Optional[list[str]] = None
    revenue_series: Optional[list[float]] = None


class SimulateRequest(StartupRef):
    scenario: str = Field(
        "marketing_increase",
        description="marketing_increase | hiring_increase | product_launch | cost_cutting",
    )


class GenericResult(BaseModel):
    ok: bool = True
    data: dict[str, Any] = {}
