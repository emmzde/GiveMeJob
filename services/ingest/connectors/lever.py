from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    map_remote_type,
    map_salary_period,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    parse_decimal,
    require_object,
    required_str,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.http import PoliteHttpClient
from services.ingest.models import ConnectorJob, ConnectorPage, RequestSpec


class LeverConnector(Connector):
    name = "lever"
    requests_per_second = 1.0
    page_size = 100

    def __init__(
        self,
        company_slug: str,
        company_name: str | None = None,
        *,
        eu: bool = False,
        http: PoliteHttpClient | None = None,
    ) -> None:
        super().__init__(http)
        self.company_slug = company_slug
        self.company_name = company_name or company_slug.replace("-", " ").title()
        self.eu = eu

    def build_request(self, cursor: str | None) -> RequestSpec:
        host = "api.eu.lever.co" if self.eu else "api.lever.co"
        return RequestSpec(
            url=f"https://{host}/v0/postings/{self.company_slug}",
            params={"mode": "json", "skip": int(cursor or "0"), "limit": self.page_size},
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        raw_jobs = object_list(payload, context="Lever response")
        jobs = [self.normalize(item) for item in raw_jobs]
        offset = int(cursor or "0")
        next_cursor = str(offset + len(jobs)) if len(jobs) == self.page_size else None
        return ConnectorPage(jobs=jobs, next_cursor=next_cursor)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        categories = require_object(raw.get("categories") or {}, context="categories")
        salary = require_object(raw.get("salaryRange") or {}, context="salaryRange")
        title = required_str(raw.get("text"), field="text")
        source_url = required_str(raw.get("hostedUrl"), field="hostedUrl")
        location = optional_str(categories.get("location"))

        list_tags: list[str] = []
        for item in object_list(raw.get("lists") or [], context="lists"):
            list_tags.extend(string_list(item.get("text")))

        return ConnectorJob(
            source=self.name,
            source_job_id=f"{self.company_slug}:{required_str(raw.get('id'), field='id')}",
            source_url=source_url,
            apply_url=optional_str(raw.get("applyUrl")) or source_url,
            attribution=f"{self.company_name} via Lever",
            title=title,
            company_name=self.company_name,
            company_slug=self.company_slug,
            description_html=optional_str(raw.get("description")) or "",
            location=location,
            remote_type=map_remote_type(raw.get("workplaceType")),
            employment_type=map_employment_type(categories.get("commitment")),
            seniority=map_seniority([title, categories.get("level")]),
            salary_min=parse_decimal(salary.get("min")),
            salary_max=parse_decimal(salary.get("max")),
            salary_currency=optional_str(salary.get("currency")),
            salary_period=map_salary_period(salary.get("interval")),
            salary_text=optional_str(raw.get("salaryDescriptionPlain")),
            posted_at=parse_datetime(raw.get("createdAt")),
            tags=string_list(categories.get("team"))
            + string_list(categories.get("department"))
            + string_list(categories.get("allLocations"))
            + list_tags,
            raw=raw,
        )
