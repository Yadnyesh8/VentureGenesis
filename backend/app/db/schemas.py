"""Pydantic schemas for request/response bodies."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.rates import RATE_FIELDS, normalize_rate


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

    # customer_growth and churn_rate are monthly FRACTIONS (0.14 = 14% MoM). A founder
    # typing 11.4 means 11.4%, so anything above 1 is read as a percentage and divided
    # once. See app/utils/rates.py for the policy; resolve_metrics repeats it for rows
    # that never passed through this schema (CSV imports, pre-existing rows).
    @field_validator(*RATE_FIELDS)
    @classmethod
    def _canonical_rate(cls, v: float, info) -> float:
        return normalize_rate(v, info.field_name)


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
    revenue_series: Optional[list[float]] = None


class SimulateRequest(StartupRef):
    scenario: str = Field(
        "marketing_increase",
        description="marketing_increase | hiring_increase | product_launch | cost_cutting",
    )


# ---- Frontier agents ----

class VOIRequest(StartupRef):
    """Value-of-Information audit. Set allow_fetch=False to score gaps without spending."""

    allow_fetch: bool = False


class AGIRequest(StartupRef):
    """AGI Pre-Conditioner. Optional founder-stated moat strengths (0-1) override inference."""

    moats: Optional[dict[str, float]] = None


class CausalRequest(StartupRef):
    """Causal trajectory mapping from current KPI state to the death node."""

    pass


class ProjectBase(BaseModel):
    """An internal R&D project evaluated for corporate spin-out viability."""

    project_name: str = "Untitled Project"
    parent_industry: Optional[str] = None
    stage: Optional[str] = None
    # All 0-1 operator-suppliable signals.
    market_disruption: float = 0.5      # how disruptive vs. the parent's core business
    cannibalization_risk: float = 0.5   # risk of eroding the parent's existing revenue
    capital_intensity: float = 0.5      # capital required relative to a lean startup
    talent_flight_risk: float = 0.5     # risk key talent leaves if kept internal
    strategic_adjacency: float = 0.5    # fit with the parent's core strategy/assets
    annual_budget: float = 0.0          # current internal annual spend on the project
    parent_cost_of_capital: float = 0.12


class SpinoutRequest(BaseModel):
    project: ProjectBase
    # Optional standalone-startup metrics for the independent-failure base estimate.
    metrics: Optional[StartupBase] = None
    description: Optional[str] = None


class GenericResult(BaseModel):
    ok: bool = True
    data: dict[str, Any] = {}
