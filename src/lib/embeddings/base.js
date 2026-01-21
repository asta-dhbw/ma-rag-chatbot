/**
 * Base interface for embedding providers
 */
export class EmbeddingProvider {
  /**
   * Generate embedding for single text
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async generateEmbedding(text) {
    throw new Error('Not implemented');
  }

  /**
   * Generate embeddings for multiple texts
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async generateEmbeddings(texts) {
    throw new Error('Not implemented');
  }

  /**
   * Get embedding dimension
   * @returns {number}
   */
  getDimension() {
    throw new Error('Not implemented');
  }

  /**
   * Get model name
   * @returns {string}
   */
  getModelName() {
    throw new Error('Not implemented');
  }
}
