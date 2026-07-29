from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from services.ingest.models import ConnectorJob, SalaryPeriod, Seniority
from services.ingest.normalize.skills import SkillMatch


class NormalizedJob(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: ConnectorJob
    title_normalized: str
    description_md: str
    country: str | None = None
    city: str | None = None
    seniority: Seniority
    min_years_exp: int | None = Field(default=None, ge=0)
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency: str | None = None
    salary_period: SalaryPeriod
    salary_usd_year: Decimal | None = None
    skills: list[SkillMatch]
    simhash: int
    blocking_key: str = Field(min_length=1)
    quality_score: float = Field(ge=0, le=1)
    embedding: list[float] | None = None
