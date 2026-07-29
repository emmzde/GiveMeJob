from __future__ import annotations

from services.ingest.connectors._utils import (
    map_employment_type,
    map_seniority,
    object_list,
    optional_str,
    parse_datetime,
    parse_int,
    require_object,
    required_str,
    slugify,
)
from services.ingest.connectors.base import Connector
from services.ingest.http import PoliteHttpClient
from services.ingest.models import ConnectorJob, ConnectorPage, RemoteType, RequestSpec


class JoobleConnector(Connector):
    name = "jooble"
    requests_per_second = 0.3
    results_per_page = 50

    def __init__(
        self,
        http: PoliteHttpClient | None = None,
        *,
        api_key: str,
        keywords: str = "software developer",
        location: str = "Remote",
    ) -> None:
        super().__init__(http)
        if not api_key:
            raise ValueError("Jooble api_key is required")
        self._api_key = api_key
        self._keywords = keywords
        self._location = location

    def build_request(self, cursor: str | None) -> RequestSpec:
        page = int(cursor or "1")
        return RequestSpec(
            method="POST",
            url=f"https://jooble.org/api/{self._api_key}",
            redacted_url="https://jooble.org/api/[REDACTED]",
            json_body={
                "keywords": self._keywords,
                "location": self._location,
                "page": str(page),
                "ResultOnPage": str(self.results_per_page),
                "companysearch": "false",
            },
        )

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        data = require_object(payload, context="Jooble response")
        jobs = [self.normalize(item) for item in object_list(data.get("jobs"), context="jobs")]
        total = parse_int(data.get("totalCount", len(jobs)), field="totalCount")
        current_page = int(cursor or "1")
        next_cursor = (
            str(current_page + 1) if jobs and current_page * self.results_per_page < total else None
        )
        return ConnectorPage(jobs=jobs, next_cursor=next_cursor, total_hint=total)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        source_url = required_str(raw.get("link"), field="link")
        company_name = required_str(raw.get("company"), field="company")
        searchable_text = " ".join(
            filter(
                None,
                (
                    optional_str(raw.get("title")),
                    optional_str(raw.get("location")),
                    optional_str(raw.get("snippet")),
                ),
            )
        ).casefold()
        remote_type = (
            RemoteType.REMOTE
            if any(token in searchable_text for token in ("remote", "work from home", "удален"))
            else RemoteType.UNKNOWN
        )
        return ConnectorJob(
            source=self.name,
            source_job_id=required_str(raw.get("id"), field="id"),
            source_url=source_url,
            apply_url=source_url,
            attribution="Jooble",
            title=required_str(raw.get("title"), field="title"),
            company_name=company_name,
            company_slug=slugify(company_name),
            description_html=optional_str(raw.get("snippet")) or "",
            location=optional_str(raw.get("location")),
            remote_type=remote_type,
            employment_type=map_employment_type(raw.get("type")),
            seniority=map_seniority(raw.get("title")),
            salary_text=optional_str(raw.get("salary")),
            posted_at=parse_datetime(raw.get("updated")),
            tags=[tag] if (tag := optional_str(raw.get("source"))) else [],
            raw=raw,
        )
