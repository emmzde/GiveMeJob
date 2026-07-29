from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from services.ingest.connectors.base import Connector
from services.ingest.embeddings import EmbeddingService
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.repository import IngestionRepository


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
        batch_size: int = 32,
    ) -> None:
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
        started_at = datetime.now(UTC)
        batch: list[NormalizedJob] = []
        scopes: set[str] = set()
        fetched = 0
        saved = 0

        async for source_job in connector.iter_jobs(limit=limit):
            normalized = self._normalizer.normalize(source_job)
            batch.append(normalized)
            scopes.add(source_job.company_slug or source_job.source)
            fetched += 1
            if len(batch) >= self._batch_size:
                saved += self._save_batch(batch, embed=embed)
                batch = []
        if batch:
            saved += self._save_batch(batch, embed=embed)

        deactivated = 0
        if limit is None:
            if not scopes and hasattr(connector, "company_slug"):
                scopes.add(str(connector.company_slug))
            for scope in scopes:
                deactivated += self._repository.deactivate_missing(
                    source=connector.name,
                    source_scope=scope,
                    seen_since=started_at,
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
