"""
Local sentence-transformers embedding provider
"""
from .base import EmbeddingProvider
from sentence_transformers import SentenceTransformer
import os
from typing import List


class LocalEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self.model_name = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        self.model = SentenceTransformer(self.model_name)
        self.dimension = int(os.getenv('EMBEDDING_DIM', '384'))

        print(f"Initialized local provider: {self.model_name} ({self.dimension}D)")

    def get_embedding(self, text: str) -> List[float]:
        return self.model.encode(text).tolist()

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts, show_progress_bar=True).tolist()

    def get_dimension(self) -> int:
        return self.dimension

    def get_model_name(self) -> str:
        return self.model_name
