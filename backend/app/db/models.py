"""SQLAlchemy ORM models (Phase 2)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class Startup(Base):
    __tablename__ = "startups"

    id = Column(Integer, primary_key=True, index=True)
    startup_name = Column(String(255), nullable=False, index=True)
    industry = Column(String(120))
    business_model = Column(String(120))
    stage = Column(String(80))
    founding_year = Column(Integer)
    revenue = Column(Float, default=0.0)
    expenses = Column(Float, default=0.0)
    burn_rate = Column(Float, default=0.0)
    runway = Column(Float, default=0.0)  # months
    customer_count = Column(Integer, default=0)
    customer_growth = Column(Float, default=0.0)
    churn_rate = Column(Float, default=0.0)
    funding_amount = Column(Float, default=0.0)
    employee_count = Column(Integer, default=0)
    valuation = Column(Float, default=0.0)
    status = Column(String(40), default="Active")  # Active | Failed | Acquired
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="startup", cascade="all, delete-orphan")
    forecasts = relationship("Forecast", back_populates="startup", cascade="all, delete-orphan")
    debates = relationship("Debate", back_populates="startup", cascade="all, delete-orphan")
    pivot_results = relationship("PivotResult", back_populates="startup", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "startup_name": self.startup_name,
            "industry": self.industry,
            "business_model": self.business_model,
            "stage": self.stage,
            "founding_year": self.founding_year,
            "revenue": self.revenue,
            "expenses": self.expenses,
            "burn_rate": self.burn_rate,
            "runway": self.runway,
            "customer_count": self.customer_count,
            "customer_growth": self.customer_growth,
            "churn_rate": self.churn_rate,
            "funding_amount": self.funding_amount,
            "employee_count": self.employee_count,
            "valuation": self.valuation,
            "status": self.status,
        }


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), index=True)
    failure_probability = Column(Float)
    funding_probability = Column(Float)
    health_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    startup = relationship("Startup", back_populates="predictions")


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), index=True)
    forecast_3m = Column(Float)
    forecast_6m = Column(Float)
    forecast_12m = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    startup = relationship("Startup", back_populates="forecasts")


class Debate(Base):
    __tablename__ = "debates"

    id = Column(Integer, primary_key=True, index=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), index=True)
    agent_name = Column(String(80))
    round = Column(Integer, default=1)
    message = Column(Text)
    stance = Column(String(40))
    timestamp = Column(DateTime, default=datetime.utcnow)

    startup = relationship("Startup", back_populates="debates")


class PivotResult(Base):
    __tablename__ = "pivot_results"

    id = Column(Integer, primary_key=True, index=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), index=True)
    pivot_name = Column(String(255))
    success_probability = Column(Float)
    roi = Column(Float)
    risk_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    startup = relationship("Startup", back_populates="pivot_results")
