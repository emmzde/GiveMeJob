from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from services.ingest.connectors.base import Connector
from services.ingest.embeddings import EmbeddingService
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.progress import ProgressReporter
from services.ingest.repository import IngestionRepository

PERSISTENCE_BATCH_MIN = 500
PERSISTENCE_BATCH_MAX = 1000


class IngestionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connector: str
    fetched: int = Field(ge=0)
    saved: int = Field(ge=0)
    deactivated: int = Field(ge=0)


class IngestionPipeline:
    def __init__(
        self,
        normalizer: JobNormalizer,
        repository: IngestionRepository,
        embedding_service: EmbeddingService,
        *,
        batch_size: int = PERSISTENCE_BATCH_MIN,
    ) -> None:
        if not PERSISTENCE_BATCH_MIN <= batch_size <= PERSISTENCE_BATCH_MAX:
            raise ValueError(
                "persistence batch size must be between "
                f"{PERSISTENCE_BATCH_MIN} and {PERSISTENCE_BATCH_MAX}"
            )
        self._normalizer = normalizer
        self._repository = repository
        self._embedding_service = embedding_service
        self._batch_size = batch_size

    async def run_connector(
        self,
        connector: Connector,
        *,
        limit: int | None = None,
        embed: bool = True,
    ) -> IngestionResult:
        full_sweep = limit is None
        checkpoint = (
            self._repository.begin_sweep(
                connector=connector.name,
                source_scope=connector.checkpoint_scope,
            )
            if full_sweep
            else None
        )
        started_at = checkpoint.started_at if checkpoint else datetime.now(UTC)
        start_cursor = checkpoint.cursor if checkpoint else None
        batch: list[NormalizedJob] = []
        fetched = checkpoint.processed if checkpoint else 0
        saved = checkpoint.processed if checkpoint else 0
        total_hint = checkpoint.total_hint if checkpoint else limit
        completed = False

        with ProgressReporter(
            f"connector:{connector.name}",
            total=total_hint,
        ) as progress:
            progress.update(fetched, total=total_hint)
            async for page in connector.iter_pages(start_cursor=start_cursor):
                page_total = page.total_hint
                if page_total is not None and limit is not None:
                    page_total = min(page_total, limit)
                total_hint = page_total if page_total is not None else total_hint
                page_jobs = page.jobs
                limit_reached = False
                if limit is not None:
                    remaining = max(limit - fetched, 0)
                    page_jobs = page_jobs[:remaining]
                    limit_reached = (
                        len(page_jobs) < len(page.jobs) or fetched + len(page_jobs) >= limit
                    )

                for source_job in page_jobs:
                    batch.append(self._normalizer.normalize(source_job))
                    fetched += 1
                    progress.update(fetched, total=total_hint)

                completed = page.next_cursor is None
                should_flush = len(batch) >= self._batch_size or completed or limit_reached
                if should_flush and batch:
                    saved += self._save_batch(batch, embed=embed)
                    batch = []
                    if full_sweep and not completed:
                        self._repository.save_sweep_progress(
                            connector=connector.name,
                            source_scope=connector.checkpoint_scope,
                            cursor=page.next_cursor,
                            processed=fetched,
                            total_hint=total_hint,
                        )
                if completed or limit_reached:
                    break

            deactivated = 0
            if full_sweep and completed:
                deactivated = self._repository.deactivate_missing(
                    source=connector.name,
                    source_scope=connector.deactivation_scope,
                    seen_since=started_at,
                )
                self._repository.complete_sweep(
                    connector=connector.name,
                    source_scope=connector.checkpoint_scope,
                    processed=fetched,
                    total_hint=total_hint,
                )
        return IngestionResult(
            connector=connector.name,
            fetched=fetched,
            saved=saved,
            deactivated=deactivated,
        )

    def _save_batch(self, jobs: list[NormalizedJob], *, embed: bool) -> int:
        if embed:
            texts = [f"passage: {job.source.title}\n{job.description_md}" for job in jobs]
            embeddings = self._embedding_service.embed_passages(texts)
            jobs = [
                job.model_copy(update={"embedding": embedding})
                for job, embedding in zip(jobs, embeddings, strict=True)
            ]
        return self._repository.save_jobs(jobs)
