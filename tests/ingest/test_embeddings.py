from collections.abc import Iterable

from services.ingest.embeddings import EMBEDDING_DIMENSION, EmbeddingService


class FakeVector:
    def tolist(self) -> list[float]:
        return [0.25] * EMBEDDING_DIMENSION


class FakeBackend:
    def passage_embed(
        self,
        documents: list[str],
        batch_size: int = 256,
        parallel: int | None = None,
    ) -> Iterable[FakeVector]:
        del batch_size, parallel
        return [FakeVector() for _ in documents]


def test_embedding_service_enforces_1024_dimensions() -> None:
    service = EmbeddingService(backend=FakeBackend())

    vectors = service.embed_passages(["passage: Python engineer"])

    assert len(vectors) == 1
    assert len(vectors[0]) == EMBEDDING_DIMENSION
