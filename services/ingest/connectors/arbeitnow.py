from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    object_list,
    optional_str,
    parse_datetime,
    parse_page_from_url,
    require_object,
    required_str,
    slugify,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class ArbeitnowConnector(Connector):
    name = "arbeitnow"
    requests_per_second = 0.5
    endpoint = "https://www.arbeitnow.com/api/job-board-api"

    def build_request(self, cursor: str | None) -> RequestSpec:
        return RequestSpec(url=self.endpoint, params={"page": int(cursor or "1")})

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Arbeitnow response")
        jobs = [self.normalize(item) for item in object_list(data.get("data"), context="data")]
        links = require_object(data.get("links", {}), context="links")
        meta = require_object(data.get("meta", {}), context="meta")
        next_cursor = parse_page_from_url(links.get("next"))
        total_value = meta.get("total")
        total = int(total_value) if isinstance(total_value, (int, float, str)) else None
        return ConnectorPage(jobs=jobs, next_cursor=next_cursor, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("url"), field="url")
        company_name = required_str(raw.get("company_name"), field="company_name")
        job_types = string_list(raw.get("job_types"))
        return ConnectorJob(
            source=self.name,
            source_job_id=required_str(raw.get("slug"), field="slug"),
            source_url=source_url,
            apply_url=source_url,
            attribution="Arbeitnow",
            title=required_str(raw.get("title"), field="title"),
            company_name=company_name,
            company_slug=slugify(company_name),
            description_html=optional_str(raw.get("description")) or "",
            location=optional_str(raw.get("location")),
            remote_type=RemoteType.REMOTE if raw.get("remote") is True else RemoteType.ONSITE,
            employment_type=map_employment_type(job_types[0] if job_types else None),
            posted_at=parse_datetime(raw.get("created_at")),
            tags=string_list(raw.get("tags")) + job_types,
            raw=raw,
        )
