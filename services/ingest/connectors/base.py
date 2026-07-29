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

    async def fetch(self, cursor: str | None = None) -> ConnectorPage:
        if self._http is None:
            raise RuntimeError(f"{self.name} connector has no HTTP client")
        request = self.build_request(cursor)
        payload = await self._http.request_json(
            request,
            requests_per_second=self.requests_per_second,
        )
        return self.parse_page(payload, cursor)

    async def iter_jobs(self, *, limit: int | None = None) -> AsyncIterator[ConnectorJob]:
        if limit is not None and limit <= 0:
            return

        emitted = 0
        cursor: str | None = None
        seen_cursors: set[str] = set()
        while True:
            page = await self.fetch(cursor)
            for job in page.jobs:
                yield job
                emitted += 1
                if limit is not None and emitted >= limit:
                    return

            cursor = page.next_cursor
            if cursor is None:
                return
            if cursor in seen_cursors:
                raise RuntimeError(f"{self.name} returned a repeated cursor: {cursor}")
            seen_cursors.add(cursor)

    @abstractmethod
    def build_request(self, cursor: str | None) -> RequestSpec:
        """Build a provider request without performing any I/O."""

    @abstractmethod
    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        """Validate one fixed/live provider response and normalize its jobs."""

    @abstractmethod
    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        """Normalize one provider object into the shared connector contract."""
