from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    parse_decimal,
    parse_int,
    require_object,
    required_str,
    slugify,
)
from services.ingest.connectors.base import Connector
from services.ingest.http import PoliteHttpClient
from services.ingest.models import (
    ConnectorJob,
    ConnectorPage,
    RemoteType,
    RequestSpec,
    SalaryPeriod,
)

_COUNTRY_CURRENCIES = {
    "au": "AUD",
    "at": "EUR",
    "be": "EUR",
    "br": "BRL",
    "ca": "CAD",
    "de": "EUR",
    "es": "EUR",
    "fr": "EUR",
    "gb": "GBP",
    "in": "INR",
    "it": "EUR",
    "mx": "MXN",
    "nl": "EUR",
    "nz": "NZD",
    "pl": "PLN",
    "sg": "SGD",
    "us": "USD",
    "za": "ZAR",
}


class AdzunaConnector(Connector):
    name = "adzuna"
    requests_per_second = 0.3
    results_per_page = 50

    def __init__(
        self,
        http: PoliteHttpClient | None = None,
        *,
        app_id: str,
        app_key: str,
        country: str = "gb",
        query: str = "software",
    ) -> None:
        super().__init__(http)
        if not app_id or not app_key:
            raise ValueError("Adzuna app_id and app_key are required")
        self._app_id = app_id
        self._app_key = app_key
        self._country = country.casefold()
        self._query = query

    def build_request(self, cursor: str | None) -> RequestSpec:
        page = int(cursor or "1")
        return RequestSpec(
            url=f"https://api.adzuna.com/v1/api/jobs/{self._country}/search/{page}",
            params={
                "app_id": self._app_id,
                "app_key": self._app_key,
                "results_per_page": self.results_per_page,
                "what": self._query,
                "sort_by": "date",
                "content-type": "application/json",
            },
            redacted_url=(f"https://api.adzuna.com/v1/api/jobs/{self._country}/search/{page}"),
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Adzuna response")
        jobs = [
            self.normalize(item) for item in object_list(data.get("results"), context="results")
        ]
        total = parse_int(data.get("count", len(jobs)), field="count")
        current_page = int(cursor or "1")
        next_cursor = (
            str(current_page + 1) if jobs and current_page * self.results_per_page < total else None
        )
        return ConnectorPage(jobs=jobs, next_cursor=next_cursor, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("redirect_url"), field="redirect_url")
        company = require_object(raw.get("company"), context="company")
        company_name = required_str(company.get("display_name"), field="company.display_name")
        location = require_object(raw.get("location", {}), context="location")
        category = require_object(raw.get("category", {}), context="category")
        searchable_text = " ".join(
            filter(
                None,
                (
                    optional_str(raw.get("title")),
                    optional_str(raw.get("description")),
                    optional_str(location.get("display_name")),
                ),
            )
        ).casefold()
        remote_type = (
            RemoteType.REMOTE
            if any(token in searchable_text for token in ("remote", "work from home", "home-based"))
            else RemoteType.UNKNOWN
        )
        return ConnectorJob(
            source=self.name,
            source_job_id=required_str(raw.get("id"), field="id"),
            source_url=source_url,
            apply_url=source_url,
            attribution="Adzuna",
            title=required_str(raw.get("title"), field="title"),
            company_name=company_name,
            company_slug=slugify(company_name),
            description_html=optional_str(raw.get("description")) or "",
            location=optional_str(location.get("display_name")),
            remote_type=remote_type,
            employment_type=map_employment_type(raw.get("contract_time", raw.get("contract_type"))),
            seniority=map_seniority(raw.get("title")),
            salary_min=parse_decimal(raw.get("salary_min")),
            salary_max=parse_decimal(raw.get("salary_max")),
            salary_currency=_COUNTRY_CURRENCIES.get(self._country),
            salary_period=SalaryPeriod.YEAR,
            posted_at=parse_datetime(raw.get("created")),
            tags=[tag] if (tag := optional_str(category.get("label"))) else [],
            raw=raw,
        )
