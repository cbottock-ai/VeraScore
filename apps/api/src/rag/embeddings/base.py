"""
Abstract base class for embedding providers.

Allows swapping between OpenAI, Cohere, local models, etc.
"""

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Abstract embedding provider interface."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension."""
        ...

    @abstractmethod
    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts efficiently."""
        ...
