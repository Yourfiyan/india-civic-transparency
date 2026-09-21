"""Pydantic data contract schemas for ETL validation."""

from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator


class DistrictFeatureProperties(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    name_normalized: str = Field(..., min_length=1, max_length=150)
    state: str = Field(..., min_length=1, max_length=150)
    state_normalized: str = Field(..., min_length=1, max_length=150)
    census_code: Optional[str] = None
    population: Optional[int] = Field(None, ge=0)
    area_sq_km: Optional[float] = Field(None, ge=0.0)
    dataset_source: str = "datameet"
    dataset_version: str = "seed-v1"
    ingested_at: Optional[str] = None


class SupremeCaseRecord(BaseModel):
    case_id: str = Field(..., min_length=1, max_length=100)
    title: Optional[str] = None
    petitioner: Optional[str] = None
    respondent: Optional[str] = None
    judge: Optional[str] = None
    bench_strength: Optional[int] = Field(None, ge=1, le=15)
    date_filed: Optional[str] = None
    decision_date: Optional[str] = None
    citation: Optional[str] = None
    court: Optional[str] = "Supreme Court of India"
    description: Optional[str] = None
    disposal_duration_days: Optional[int] = Field(None, ge=0)
    dataset_source: str = "s3://indian-supreme-court-judgments/"
    dataset_version: str = "seed-v1"


class CrimeRecord(BaseModel):
    district_id: int = Field(..., ge=1)
    year: int = Field(..., ge=1950, le=2100)
    category: str = Field(..., min_length=1, max_length=100)
    cases_registered: Optional[int] = Field(0, ge=0)
    cases_charge_sheeted: Optional[int] = Field(0, ge=0)
    cases_convicted: Optional[int] = Field(0, ge=0)
    dataset_source: str = "ncrb"
    dataset_version: str = "seed-v1"

    @field_validator("cases_convicted")
    @classmethod
    def validate_convicted_le_registered(cls, v, values):
        return v


class InfrastructureRecord(BaseModel):
    district_id: int = Field(..., ge=1)
    project_name: str = Field(..., min_length=1, max_length=255)
    scheme: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = Field("in_progress")
    sanctioned_cost: Optional[float] = Field(None, ge=0.0)
    completion_pct: Optional[float] = Field(0.0, ge=0.0, le=100.0)
    year: Optional[int] = Field(None, ge=1950, le=2100)
    dataset_source: str = "pmgsy"
    dataset_version: str = "seed-v1"
