import { OpenAIEmbeddingProvider } from './embeddings/openai-provider.js';
import { LocalEmbeddingProvider } from './embeddings/local-provider.js';

let providerInstance = null;

/**
 * Get singleton embedding provider instance
 * @returns {Promise<EmbeddingProvider>}
 */
async function getProvider() {
  if (!providerInstance) {
    const providerType = process.env.EMBEDDING_PROVIDER || 'local';

    if (providerType === 'openai') {
      providerInstance = new OpenAIEmbeddingProvider();
    } else if (providerType === 'local') {
      providerInstance = new LocalEmbeddingProvider();
    } else {
      throw new Error(`Unknown embedding provider: ${providerType}`);
    }
  }

  return providerInstance;
}

/**
 * Generate embedding for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
  const provider = await getProvider();
  return provider.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts) {
  const provider = await getProvider();
  return provider.generateEmbeddings(texts);
}
