from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Self
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RemoteType(StrEnum):
    ONSITE = "onsite"
    HYBRID = "hybrid"
    REMOTE = "remote"
    UNKNOWN = "unknown"


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    INTERNSHIP = "internship"
    VOLUNTEER = "volunteer"
    OTHER = "other"
    UNKNOWN = "unknown"


class Seniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MIDDLE = "middle"
    SENIOR = "senior"
    LEAD = "lead"
    STAFF = "staff"
    PRINCIPAL = "principal"
    MANAGER = "manager"
    DIRECTOR = "director"
    EXECUTIVE = "executive"
    UNKNOWN = "unknown"


class SalaryPeriod(StrEnum):
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"
    UNKNOWN = "unknown"


class ConnectorJob(BaseModel):
    """Provider-independent contract emitted by every ingestion connector."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(min_length=1)
    source_job_id: str = Field(min_length=1)
    source_url: str
    apply_url: str | None = None
    attribution: str = Field(min_length=1)

    title: str = Field(min_length=1)
    company_name: str = Field(min_length=1)
    company_slug: str | None = None
    company_logo_url: str | None = None
    description_html: str = ""
    location: str | None = None
    remote_type: RemoteType = RemoteType.UNKNOWN
    employment_type: EmploymentType = EmploymentType.UNKNOWN
    seniority: Seniority = Seniority.UNKNOWN
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency: str | None = None
    salary_period: SalaryPeriod = SalaryPeriod.UNKNOWN
    salary_text: str | None = None
    posted_at: datetime | None = None
    expires_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    raw: dict[str, object] = Field(default_factory=dict)

    @field_validator("source_url", "apply_url", "company_logo_url")
    @classmethod
    def validate_http_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("expected an absolute HTTP(S) URL")
        return value

    @field_validator("salary_currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("salary currency must be a three-letter ISO-style code")
        return normalized

    @field_validator("posted_at", "expires_at")
    @classmethod
    def normalize_datetime(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        unique: dict[str, None] = {}
        for value in values:
            normalized = " ".join(value.split()).strip()
            if normalized:
                unique.setdefault(normalized, None)
        return list(unique)

    @model_validator(mode="after")
    def validate_salary_range(self) -> Self:
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            self.salary_min, self.salary_max = self.salary_max, self.salary_min
        return self


class ConnectorPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jobs: list[ConnectorJob]
    next_cursor: str | None = None
    total_hint: int | None = Field(default=None, ge=0)


class RequestSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: str = "GET"
    url: str
    params: dict[str, str | int | float | bool] = Field(default_factory=dict)
    json_body: dict[str, object] | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    redacted_url: str | None = None
