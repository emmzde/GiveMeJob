from __future__ import annotations

from services.ingest.connectors._utils import (
    map_remote_type,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    require_object,
    required_str,
    string_list,
)
from services.ingest.connectors.base import Connector
from services.ingest.http import PoliteHttpClient
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class GreenhouseConnector(Connector):
    name = "greenhouse"
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
            url=f"https://boards-api.greenhouse.io/v1/boards/{self.company_slug}/jobs",
            params={"content": "true"},
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        del cursor
        data = require_object(payload, context="Greenhouse response")
        jobs = [self.normalize(item) for item in object_list(data.get("jobs"), context="jobs")]
        return ConnectorPage(jobs=jobs, total_hint=len(jobs))

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        location = require_object(raw.get("location") or {}, context="location")
        location_name = optional_str(location.get("name"))
        title = required_str(raw.get("title"), field="title")
        remote_type = map_remote_type(location_name)
        if remote_type is RemoteType.UNKNOWN:
            remote_type = map_remote_type(title)

        departments = [
            optional_str(item.get("name"))
            for item in object_list(raw.get("departments") or [], context="departments")
        ]
        offices = [
            optional_str(item.get("name"))
            for item in object_list(raw.get("offices") or [], context="offices")
        ]
        company_name = optional_str(raw.get("company_name")) or self.company_name
        source_url = required_str(raw.get("absolute_url"), field="absolute_url")

        return ConnectorJob(
            source=self.name,
            source_job_id=f"{self.company_slug}:{required_str(raw.get('id'), field='id')}",
            source_url=source_url,
            apply_url=source_url,
            attribution=f"{company_name} via Greenhouse",
            title=title,
            company_name=company_name,
            company_slug=self.company_slug,
            description_html=optional_str(raw.get("content")) or "",
            location=location_name,
            remote_type=remote_type,
            seniority=map_seniority(title),
            posted_at=parse_datetime(raw.get("first_published")),
            tags=[
                tag
                for tag in departments + offices + string_list(raw.get("language"))
                if tag is not None
            ],
            raw=raw,
        )
