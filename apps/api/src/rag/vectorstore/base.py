from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SearchResult:
    """Result from a vector similarity search."""

    chunk_id: int
    score: float
    metadata: dict


class VectorStore(ABC):
    """Abstract base class for vector stores."""

    @abstractmethod
    async def add_embedding(
        self, chunk_id: int, embedding: list[float], metadata: dict | None = None
    ) -> None:
        """Add a single embedding to the store."""
        pass

    @abstractmethod
    async def add_embeddings_batch(
        self, items: list[tuple[int, list[float], dict | None]]
    ) -> None:
        """Add multiple embeddings in a batch. Each item is (chunk_id, embedding, metadata)."""
        pass

    @abstractmethod
    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[SearchResult]:
        """Search for similar embeddings."""
        pass

    @abstractmethod
    async def delete_by_transcript_id(self, transcript_id: int) -> int:
        """Delete all embeddings for a transcript. Returns count deleted."""
        pass
