from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    map_salary_period,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    parse_decimal,
    parse_int,
    require_object,
    required_str,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class HimalayasConnector(Connector):
    name = "himalayas"
    requests_per_second = 2.0
    endpoint = "https://himalayas.app/jobs/api"
    page_size = 20

    def build_request(self, cursor: str | None) -> RequestSpec:
        return RequestSpec(
            url=self.endpoint,
            params={"offset": int(cursor or "0"), "limit": self.page_size},
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Himalayas response")
        jobs = [self.normalize(item) for item in object_list(data.get("jobs"), context="jobs")]
        offset = parse_int(data.get("offset", cursor or 0), field="offset")
        total = parse_int(data.get("totalCount", len(jobs)), field="totalCount")
        next_offset = offset + len(jobs)
        next_cursor = str(next_offset) if jobs and next_offset < total else None
        return ConnectorPage(jobs=jobs, next_cursor=next_cursor, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("guid"), field="guid")
        company_name = required_str(raw.get("companyName"), field="companyName")
        restrictions = raw.get("locationRestrictions")
        locations: list[str] = []
        if isinstance(restrictions, list):
            for restriction in restrictions:
                if isinstance(restriction, dict):
                    location = optional_str(restriction.get("name"))
                else:
                    location = optional_str(restriction)
                if location is not None:
                    locations.append(location)

        return ConnectorJob(
            source=self.name,
            source_job_id=source_url,
            source_url=source_url,
            apply_url=required_str(raw.get("applicationLink"), field="applicationLink"),
            attribution="Himalayas",
            title=required_str(raw.get("title"), field="title"),
            company_name=company_name,
            company_slug=optional_str(raw.get("companySlug")),
            company_logo_url=optional_str(raw.get("companyLogo")),
            description_html=optional_str(raw.get("description")) or "",
            location=", ".join(locations) if locations else "Worldwide",
            remote_type=RemoteType.REMOTE,
            employment_type=map_employment_type(raw.get("employmentType")),
            seniority=map_seniority(raw.get("seniority")),
            salary_min=parse_decimal(raw.get("minSalary")),
            salary_max=parse_decimal(raw.get("maxSalary")),
            salary_currency=optional_str(raw.get("currency")),
            salary_period=map_salary_period(raw.get("salaryPeriod")),
            posted_at=parse_datetime(raw.get("pubDate")),
            expires_at=parse_datetime(raw.get("expiryDate")),
            tags=string_list(raw.get("categories")) + string_list(raw.get("parentCategories")),
            raw=raw,
        )
