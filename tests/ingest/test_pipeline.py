from __future__ import annotations

import asyncio
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import cast

from services.ingest.connectors.base import Connector
from services.ingest.embeddings import EmbeddingService
from services.ingest.models import ConnectorJob, ConnectorPage, RequestSpec
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.pipeline import IngestionPipeline
from services.ingest.repository import IngestionCheckpoint, IngestionRepository


class FakeConnector(Connector):
    name = "fake"

    def __init__(self, pages: dict[str | None, ConnectorPage]) -> None:
        super().__init__()
        self._pages = pages
        self.requested_cursors: list[str | None] = []

    async def fetch(self, cursor: str | None = None) -> ConnectorPage:
        self.requested_cursors.append(cursor)
        page = self._pages[cursor]
        self._total_hint = page.total_hint
        return page

    def build_request(self, cursor: str | None) -> RequestSpec:
        raise AssertionError(cursor)

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        raise AssertionError(payload, cursor)

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        raise AssertionError(raw)


class FakeNormalizer:
    def normalize(self, source: ConnectorJob) -> NormalizedJob:
        return NormalizedJob(
            source=source,
            title_normalized=source.title.casefold(),
            description_md=source.description_html,
            seniority="unknown",
            salary_period="unknown",
            skills=[],
            simhash=int(source.source_job_id),
            blocking_key=f"fake:{source.source_job_id}",
            quality_score=0.5,
        )


class FakeRepository:
    def __init__(self) -> None:
        self.saved_batch_sizes: list[int] = []
        self.progress: list[tuple[str | None, int, int | None]] = []
        self.completed: tuple[int, int | None] | None = None
        self.deactivated_since: datetime | None = None
        self.started_at = datetime(2026, 7, 29, 12, tzinfo=UTC)

    def begin_sweep(self, *, connector: str, source_scope: str) -> IngestionCheckpoint:
        assert (connector, source_scope) == ("fake", "global")
        return IngestionCheckpoint(
            cursor="200",
            processed=200,
            total_hint=1000,
            started_at=self.started_at,
        )

    def save_jobs(self, jobs: Iterable[NormalizedJob]) -> int:
        batch = list(jobs)
        self.saved_batch_sizes.append(len(batch))
        return len(batch)

    def save_sweep_progress(
        self,
        *,
        connector: str,
        source_scope: str,
        cursor: str | None,
        processed: int,
        total_hint: int | None,
    ) -> None:
        assert (connector, source_scope) == ("fake", "global")
        self.progress.append((cursor, processed, total_hint))

    def deactivate_missing(
        self,
        *,
        source: str,
        source_scope: str | None,
        seen_since: datetime,
    ) -> int:
        assert (source, source_scope) == ("fake", None)
        self.deactivated_since = seen_since
        return 2

    def complete_sweep(
        self,
        *,
        connector: str,
        source_scope: str,
        processed: int,
        total_hint: int | None,
    ) -> None:
        assert (connector, source_scope) == ("fake", "global")
        self.completed = (processed, total_hint)


def _source_jobs(start: int, count: int) -> list[ConnectorJob]:
    return [
        ConnectorJob(
            source="fake",
            source_job_id=str(index),
            source_url=f"https://example.com/jobs/{index}",
            attribution="Fake",
            title=f"Engineer {index}",
            company_name="Fake Company",
            description_html="Python",
        )
        for index in range(start, start + count)
    ]


def test_pipeline_resumes_from_checkpoint_and_saves_only_page_boundaries() -> None:
    connector = FakeConnector(
        {
            "200": ConnectorPage(
                jobs=_source_jobs(200, 300),
                next_cursor="500",
                total_hint=1000,
            ),
            "500": ConnectorPage(
                jobs=_source_jobs(500, 300),
                next_cursor="800",
                total_hint=1000,
            ),
            "800": ConnectorPage(
                jobs=_source_jobs(800, 200),
                next_cursor=None,
                total_hint=1000,
            ),
        }
    )
    repository = FakeRepository()
    pipeline = IngestionPipeline(
        cast(JobNormalizer, FakeNormalizer()),
        cast(IngestionRepository, repository),
        cast(EmbeddingService, object()),
        batch_size=500,
    )

    result = asyncio.run(pipeline.run_connector(connector, embed=False))

    assert connector.requested_cursors == ["200", "500", "800"]
    assert repository.saved_batch_sizes == [600, 200]
    assert repository.progress == [("800", 800, 1000)]
    assert repository.completed == (1000, 1000)
    assert repository.deactivated_since == repository.started_at
    assert result.model_dump() == {
        "connector": "fake",
        "fetched": 1000,
        "saved": 1000,
        "deactivated": 2,
    }
