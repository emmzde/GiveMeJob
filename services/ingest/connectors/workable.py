from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
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


class WorkableConnector(Connector):
    name = "workable"
    requests_per_second = 1.0

    def __init__(
        self,
        company_slug: str,
        company_name: str | None = None,
        http: PoliteHttpClient | None = None,
    ) -> None:
        super().__init__(http)
        self.company_slug = company_slug
        self.company_name = company_name

    def build_request(self, cursor: str | None) -> RequestSpec:
        del cursor
        return RequestSpec(
            url=f"https://apply.workable.com/api/v1/widget/accounts/{self.company_slug}",
            params={"details": "true"},
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        del cursor
        data = require_object(payload, context="Workable response")
        company_name = self.company_name or required_str(data.get("name"), field="name")
        raw_jobs = object_list(data.get("jobs"), context="jobs")
        jobs = [self.normalize({**item, "__company_name": company_name}) for item in raw_jobs]
        return ConnectorPage(jobs=jobs, total_hint=len(jobs))

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        title = required_str(raw.get("title"), field="title")
        company_name = required_str(raw.get("__company_name"), field="__company_name")
        source_url = required_str(
            raw.get("url") or raw.get("shortlink"),
            field="url",
        )
        location_parts = (
            string_list(raw.get("city"))
            + string_list(raw.get("state"))
            + string_list(raw.get("country"))
        )
        locations = raw.get("locations")
        if isinstance(locations, list):
            for item in locations:
                if isinstance(item, dict):
                    location_parts.extend(
                        string_list(item.get("city"))
                        + string_list(item.get("state"))
                        + string_list(item.get("country"))
                    )
                else:
                    location_parts.extend(string_list(item))

        return ConnectorJob(
            source=self.name,
            source_job_id=(
                f"{self.company_slug}:{required_str(raw.get('shortcode'), field='shortcode')}"
            ),
            source_url=source_url,
            apply_url=optional_str(raw.get("application_url")) or source_url,
            attribution=f"{company_name} via Workable",
            title=title,
            company_name=company_name,
            company_slug=self.company_slug,
            description_html=optional_str(raw.get("description")) or "",
            location=", ".join(dict.fromkeys(location_parts)) or None,
            remote_type=RemoteType.REMOTE
            if raw.get("telecommuting") is True
            else RemoteType.UNKNOWN,
            employment_type=map_employment_type(raw.get("employment_type")),
            seniority=map_seniority(title),
            posted_at=parse_datetime(raw.get("published_on") or raw.get("created_at")),
            tags=string_list(raw.get("department"))
            + string_list(raw.get("function"))
            + string_list(raw.get("industry"))
            + string_list(raw.get("education")),
            raw={key: value for key, value in raw.items() if key != "__company_name"},
        )
