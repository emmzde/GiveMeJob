from __future__ import annotations

import json
import re
from collections.abc import Iterator
from enum import StrEnum
from pathlib import Path
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from services.ingest.connectors.ashby import AshbyConnector
from services.ingest.connectors.base import Connector
from services.ingest.connectors.greenhouse import GreenhouseConnector
from services.ingest.connectors.lever import LeverConnector
from services.ingest.connectors.workable import WorkableConnector
from services.ingest.http import PoliteHttpClient

_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


class ATSProvider(StrEnum):
    GREENHOUSE = "greenhouse"
    LEVER = "lever"
    ASHBY = "ashby"
    WORKABLE = "workable"


class ATSRegistryEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    provider: ATSProvider
    company_slug: str = Field(min_length=1)
    poll_hours: int = Field(ge=6, le=12)


class ATSRegistry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = Field(ge=1)
    poll_hours: int = Field(ge=6, le=12)
    companies: dict[ATSProvider, list[str]]

    @model_validator(mode="after")
    def validate_companies(self) -> Self:
        missing = set(ATSProvider) - set(self.companies)
        if missing:
            raise ValueError(f"missing ATS providers: {sorted(missing)}")

        count = 0
        for provider, slugs in self.companies.items():
            if len(slugs) != len(set(slugs)):
                raise ValueError(f"{provider} registry contains duplicate slugs")
            invalid = [slug for slug in slugs if _SLUG_RE.fullmatch(slug) is None]
            if invalid:
                raise ValueError(f"{provider} registry contains invalid slugs: {invalid}")
            count += len(slugs)
        if count < 300:
            raise ValueError(f"ATS registry must contain at least 300 companies, found {count}")
        return self

    @property
    def company_count(self) -> int:
        return sum(len(slugs) for slugs in self.companies.values())

    def entries(self) -> Iterator[ATSRegistryEntry]:
        for provider, slugs in self.companies.items():
            for slug in slugs:
                yield ATSRegistryEntry(
                    provider=provider,
                    company_slug=slug,
                    poll_hours=self.poll_hours,
                )


def load_ats_registry(path: Path) -> ATSRegistry:
    return ATSRegistry.model_validate_json(path.read_text(encoding="utf-8"))


def connector_for(entry: ATSRegistryEntry, http: PoliteHttpClient) -> Connector:
    if entry.provider is ATSProvider.GREENHOUSE:
        return GreenhouseConnector(entry.company_slug, http=http)
    if entry.provider is ATSProvider.LEVER:
        return LeverConnector(entry.company_slug, http=http)
    if entry.provider is ATSProvider.ASHBY:
        return AshbyConnector(entry.company_slug, http=http)
    if entry.provider is ATSProvider.WORKABLE:
        return WorkableConnector(entry.company_slug, http=http)
    raise ValueError(f"unsupported ATS provider: {entry.provider}")


def registry_as_json(registry: ATSRegistry) -> str:
    return json.dumps(registry.model_dump(mode="json"), ensure_ascii=False, indent=2)
