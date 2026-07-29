from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    object_list,
    optional_str,
    parse_datetime,
    require_object,
    required_str,
    slugify,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class RemotiveConnector(Connector):
    name = "remotive"
    requests_per_second = 0.03
    endpoint = "https://remotive.com/api/remote-jobs"

    def build_request(self, cursor: str | None) -> RequestSpec:
        return RequestSpec(url=self.endpoint)

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Remotive response")
        jobs = [self.normalize(item) for item in object_list(data.get("jobs"), context="jobs")]
        total_value = data.get("total-job-count", data.get("job-count"))
        total = int(total_value) if isinstance(total_value, (int, float, str)) else len(jobs)
        return ConnectorPage(jobs=jobs, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("url"), field="url")
        company_name = required_str(raw.get("company_name"), field="company_name")
        return ConnectorJob(
            source=self.name,
            source_job_id=required_str(raw.get("id"), field="id"),
            source_url=source_url,
            apply_url=source_url,
            attribution="Remotive",
            title=required_str(raw.get("title"), field="title"),
            company_name=company_name,
            company_slug=slugify(company_name),
            company_logo_url=optional_str(raw.get("company_logo_url", raw.get("company_logo"))),
            description_html=optional_str(raw.get("description")) or "",
            location=optional_str(raw.get("candidate_required_location")) or "Worldwide",
            remote_type=RemoteType.REMOTE,
            employment_type=map_employment_type(raw.get("job_type")),
            salary_text=optional_str(raw.get("salary")),
            posted_at=parse_datetime(raw.get("publication_date")),
            tags=string_list(raw.get("tags")) + string_list(raw.get("category")),
            raw=raw,
        )
