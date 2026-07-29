from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from services.ingest.http import PoliteHttpClient
from services.ingest.models import ConnectorJob, ConnectorPage, RequestSpec


class Connector(ABC):
    """Base contract for paginated, fixture-testable job source connectors."""

    name: str
    requests_per_second: float = 1.0

    def __init__(self, http: PoliteHttpClient | None = None) -> None:
        self._http = http
        self._total_hint: int | None = None

    @property
    def total_hint(self) -> int | None:
        return self._total_hint

    @property
    def checkpoint_scope(self) -> str:
        company_slug = getattr(self, "company_slug", None)
        return str(company_slug) if company_slug is not None else "global"

    @property
    def deactivation_scope(self) -> str | None:
        company_slug = getattr(self, "company_slug", None)
        return str(company_slug) if company_slug is not None else None

    async def fetch(self, cursor: str | None = None) -> ConnectorPage:
        if self._http is None:
            raise RuntimeError(f"{self.name} connector has no HTTP client")
        request = self.build_request(cursor)
        payload = await self._http.request_json(
            request,
            requests_per_second=self.requests_per_second,
        )
        page = self.parse_page(payload, cursor)
        if page.total_hint is not None:
            self._total_hint = page.total_hint
        return page

    async def iter_pages(
        self,
        *,
        start_cursor: str | None = None,
    ) -> AsyncIterator[ConnectorPage]:
        cursor = start_cursor
        seen_cursors = {start_cursor} if start_cursor is not None else set()
        while True:
            page = await self.fetch(cursor)
            yield page
            cursor = page.next_cursor
            if cursor is None:
                return
            if cursor in seen_cursors:
                raise RuntimeError(f"{self.name} returned a repeated cursor: {cursor}")
            seen_cursors.add(cursor)

    async def iter_jobs(
        self,
        *,
        limit: int | None = None,
        start_cursor: str | None = None,
    ) -> AsyncIterator[ConnectorJob]:
        if limit is not None and limit <= 0:
            return

        emitted = 0
        async for page in self.iter_pages(start_cursor=start_cursor):
            for job in page.jobs:
                yield job
                emitted += 1
                if limit is not None and emitted >= limit:
                    return

    @abstractmethod
    def build_request(self, cursor: str | None) -> RequestSpec:
        """Build a provider request without performing any I/O."""

    @abstractmethod
    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        """Validate one fixed/live provider response and normalize its jobs."""

    @abstractmethod
    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        """Normalize one provider object into the shared connector contract."""
