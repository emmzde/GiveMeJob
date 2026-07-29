from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Protocol, cast

from fastembed import TextEmbedding

DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-large"
EMBEDDING_DIMENSION = 1024


class EmbeddingVector(Protocol):
    def tolist(self) -> list[float]: ...


class EmbeddingBackend(Protocol):
    def passage_embed(
        self,
        documents: list[str],
        batch_size: int = 256,
        parallel: int | None = None,
    ) -> Iterable[EmbeddingVector]: ...


class EmbeddingService:
    """Generate 1024-dimensional local vectors during ingestion only."""

    def __init__(
        self,
        model_name: str = DEFAULT_EMBEDDING_MODEL,
        *,
        cache_dir: str | None = None,
        backend: EmbeddingBackend | None = None,
    ) -> None:
        self.model_name = model_name
        self._cache_dir = cache_dir
        self._backend = backend

    def embed_passages(self, texts: Sequence[str], *, batch_size: int = 32) -> list[list[float]]:
        if not texts:
            return []
        backend = self._backend or self._load_backend()
        vectors = [
            vector.tolist()
            for vector in backend.passage_embed(
                list(texts),
                batch_size=batch_size,
            )
        ]
        for vector in vectors:
            if len(vector) != EMBEDDING_DIMENSION:
                raise ValueError(
                    f"{self.model_name} produced {len(vector)} dimensions; "
                    f"expected {EMBEDDING_DIMENSION}"
                )
        return vectors

    def _load_backend(self) -> EmbeddingBackend:
        backend = TextEmbedding(
            model_name=self.model_name,
            cache_dir=self._cache_dir,
            lazy_load=True,
        )
        self._backend = cast(EmbeddingBackend, backend)
        return self._backend
