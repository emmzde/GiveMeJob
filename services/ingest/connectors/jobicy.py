from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    map_salary_period,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    parse_decimal,
    require_object,
    required_str,
    slugify,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class JobicyConnector(Connector):
    name = "jobicy"
    requests_per_second = 0.1
    endpoint = "https://jobicy.com/api/v2/remote-jobs"
    result_count = 50

    def build_request(self, cursor: str | None) -> RequestSpec:
        return RequestSpec(url=self.endpoint, params={"count": self.result_count})

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Jobicy response")
        jobs = [self.normalize(item) for item in object_list(data.get("jobs"), context="jobs")]
        total_value = data.get("jobCount")
        total = int(total_value) if isinstance(total_value, (int, float, str)) else len(jobs)
        return ConnectorPage(jobs=jobs, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("url"), field="url")
        company_name = required_str(raw.get("companyName"), field="companyName")
        return ConnectorJob(
            source=self.name,
            source_job_id=required_str(raw.get("id"), field="id"),
            source_url=source_url,
            apply_url=source_url,
            attribution="Jobicy",
            title=required_str(raw.get("jobTitle"), field="jobTitle"),
            company_name=company_name,
            company_slug=slugify(company_name),
            company_logo_url=optional_str(raw.get("companyLogo")),
            description_html=optional_str(raw.get("jobDescription")) or "",
            location=optional_str(raw.get("jobGeo")) or "Worldwide",
            remote_type=RemoteType.REMOTE,
            employment_type=map_employment_type(raw.get("jobType")),
            seniority=map_seniority(raw.get("jobLevel")),
            salary_min=parse_decimal(raw.get("salaryMin")),
            salary_max=parse_decimal(raw.get("salaryMax")),
            salary_currency=optional_str(raw.get("salaryCurrency")),
            salary_period=map_salary_period(raw.get("salaryPeriod")),
            posted_at=parse_datetime(raw.get("pubDate")),
            tags=string_list(raw.get("jobIndustry")),
            raw=raw,
        )
