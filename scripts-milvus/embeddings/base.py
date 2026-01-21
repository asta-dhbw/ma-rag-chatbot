"""
Abstract base class for embedding providers
"""
from abc import ABC, abstractmethod
from typing import List


class EmbeddingProvider(ABC):
    @abstractmethod
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        pass

    @abstractmethod
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batch)"""
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        """Return embedding dimension"""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return model name"""
        pass
