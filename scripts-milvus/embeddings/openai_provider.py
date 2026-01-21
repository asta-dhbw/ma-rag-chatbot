"""
OpenAI embedding provider implementation
"""
from .base import EmbeddingProvider
import openai
import os
from typing import List


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.model = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')
        self.dimension = int(os.getenv('EMBEDDING_DIM', '1536'))

        print(f"Initialized OpenAI provider: {self.model} ({self.dimension}D)")

    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation (OpenAI supports up to 2048 texts)"""
        # Process in batches of 2000 to stay under API limit
        batch_size = 2000
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                model=self.model,
                input=batch
            )
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)

            print(f"  Generated {len(embeddings)} embeddings ({i+len(batch)}/{len(texts)})")

        return all_embeddings

    def get_dimension(self) -> int:
        return self.dimension

    def get_model_name(self) -> str:
        return self.model
