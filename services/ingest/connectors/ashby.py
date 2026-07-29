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
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class AshbyConnector(Connector):
    name = "ashby"
    requests_per_second = 1.0

    def __init__(
        self,
        company_slug: str,
        company_name: str | None = None,
        http: PoliteHttpClient | None = None,
    ) -> None:
        super().__init__(http)
        self.company_slug = company_slug
        self.company_name = company_name or company_slug.replace("-", " ").title()

    def build_request(self, cursor: str | None) -> RequestSpec:
        del cursor
        return RequestSpec(
            url=f"https://api.ashbyhq.com/posting-api/job-board/{self.company_slug}",
            params={"includeCompensation": "true"},
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        del cursor
        data = require_object(payload, context="Ashby response")
        raw_jobs = object_list(data.get("jobs"), context="jobs")
        jobs = [self.normalize(item) for item in raw_jobs if item.get("isListed") is not False]
        return ConnectorPage(jobs=jobs, total_hint=len(jobs))

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        compensation = require_object(raw.get("compensation") or {}, context="compensation")
        salary = self._salary_component(compensation)
        title = required_str(raw.get("title"), field="title")
        source_url = required_str(raw.get("jobUrl"), field="jobUrl")
        remote_type = (
            RemoteType.REMOTE
            if raw.get("isRemote") is True
            else map_remote_type(raw.get("workplaceType"))
        )

        secondary_locations: list[str] = []
        for item in object_list(raw.get("secondaryLocations") or [], context="secondaryLocations"):
            location = optional_str(item.get("location")) or optional_str(item.get("name"))
            if location is not None:
                secondary_locations.append(location)
        locations = string_list(raw.get("location")) + secondary_locations

        return ConnectorJob(
            source=self.name,
            source_job_id=f"{self.company_slug}:{required_str(raw.get('id'), field='id')}",
            source_url=source_url,
            apply_url=optional_str(raw.get("applyUrl")) or source_url,
            attribution=f"{self.company_name} via Ashby",
            title=title,
            company_name=self.company_name,
            company_slug=self.company_slug,
            description_html=optional_str(raw.get("descriptionHtml")) or "",
            location=", ".join(locations) or None,
            remote_type=remote_type,
            employment_type=map_employment_type(raw.get("employmentType")),
            seniority=map_seniority(title),
            salary_min=parse_decimal(salary.get("minValue")),
            salary_max=parse_decimal(salary.get("maxValue")),
            salary_currency=optional_str(salary.get("currencyCode")),
            salary_period=map_salary_period(salary.get("interval")),
            salary_text=optional_str(compensation.get("compensationTierSummary")),
            posted_at=parse_datetime(raw.get("publishedAt")),
            tags=string_list(raw.get("department")) + string_list(raw.get("team")),
            raw=raw,
        )

    @staticmethod
    def _salary_component(compensation: dict[str, object]) -> dict[str, object]:
        for component in object_list(
            compensation.get("summaryComponents") or [],
            context="summaryComponents",
        ):
            if optional_str(component.get("compensationType")) == "Salary":
                return component
        return {}
