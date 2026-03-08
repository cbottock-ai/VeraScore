"""
OpenAI embedding provider implementation.
"""

from openai import AsyncOpenAI

from src.core.config import settings
from src.rag.embeddings.base import EmbeddingProvider


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI text-embedding-3-small provider."""

    def __init__(
        self,
        model: str | None = None,
        dimension: int | None = None,
    ):
        self._model = model or settings.embedding_model
        self._dimension = dimension or settings.embedding_dimension
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        response = await self._client.embeddings.create(
            model=self._model,
            input=text,
            dimensions=self._dimension,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts efficiently."""
        if not texts:
            return []

        # OpenAI supports batching natively
        response = await self._client.embeddings.create(
            model=self._model,
            input=texts,
            dimensions=self._dimension,
        )

        # Sort by index to maintain order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
