"""
Abstract base class for vector stores.

Allows swapping between sqlite-vec, Pinecone, Chroma, etc.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class SearchResult:
    """A single search result from the vector store."""

    chunk_id: int
    content: str
    score: float  # Similarity score (higher = more similar)
    metadata: dict[str, Any]  # ticker, speaker, section, etc.


class VectorStore(ABC):
    """Abstract vector store interface."""

    @abstractmethod
    async def add_embedding(
        self,
        chunk_id: int,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store an embedding with its chunk ID and metadata."""
        ...

    @abstractmethod
    async def add_embeddings_batch(
        self,
        items: list[tuple[int, list[float], dict[str, Any] | None]],
    ) -> None:
        """Store multiple embeddings efficiently."""
        ...

    @abstractmethod
    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """
        Search for similar embeddings.

        Args:
            query_embedding: The query vector
            top_k: Number of results to return
            filter_metadata: Optional filters (e.g., {"ticker": "AAPL"})

        Returns:
            List of SearchResult ordered by similarity (highest first)
        """
        ...

    @abstractmethod
    async def delete_by_transcript_id(self, transcript_id: int) -> int:
        """
        Delete all embeddings for a transcript.

        Returns the number of embeddings deleted.
        """
        ...
