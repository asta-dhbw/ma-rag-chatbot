"""
Embedding providers package
"""
import os
from .base import EmbeddingProvider
from .openai_provider import OpenAIEmbeddingProvider
from .local_provider import LocalEmbeddingProvider


def get_embedding_provider() -> EmbeddingProvider:
    """
    Factory function to get the appropriate embedding provider
    based on EMBEDDING_PROVIDER environment variable.

    Options:
        - 'openai': Use OpenAI API embeddings
        - 'local': Use local sentence-transformers model

    Defaults to 'local' if not specified.
    """
    provider_type = os.getenv('EMBEDDING_PROVIDER', 'local').lower()

    if provider_type == 'openai':
        return OpenAIEmbeddingProvider()
    elif provider_type == 'local':
        return LocalEmbeddingProvider()
    else:
        raise ValueError(f"Unknown embedding provider: {provider_type}. Use 'openai' or 'local'.")
