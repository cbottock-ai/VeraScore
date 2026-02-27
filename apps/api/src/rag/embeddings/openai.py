import logging

from openai import AsyncOpenAI

from src.core.config import settings
from src.rag.embeddings.base import EmbeddingProvider

logger = logging.getLogger(__name__)


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider using text-embedding-3-small."""

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
        """Embed a single text string."""
        response = await self._client.embeddings.create(
            model=self._model,
            input=text,
            dimensions=self._dimension,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple text strings in a batch."""
        if not texts:
            return []

        # OpenAI supports batching up to 2048 inputs
        response = await self._client.embeddings.create(
            model=self._model,
            input=texts,
            dimensions=self._dimension,
        )
        # Sort by index to ensure correct ordering
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
