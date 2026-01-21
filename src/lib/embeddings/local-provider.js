import { pipeline } from '@xenova/transformers';
import { EmbeddingProvider } from './base.js';

export class LocalEmbeddingProvider extends EmbeddingProvider {
  constructor() {
    super();
    this.modelName = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.dimension = parseInt(process.env.EMBEDDING_DIM || '384', 10);
    this.pipeline = null;
  }

  async ensureLoaded() {
    if (!this.pipeline) {
      console.log(`Initializing local model: ${this.modelName}...`);
      this.pipeline = await pipeline('feature-extraction', this.modelName);
      console.log('Model loaded successfully');
    }
  }

  async generateEmbedding(text) {
    await this.ensureLoaded();
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }

  async generateEmbeddings(texts) {
    await this.ensureLoaded();
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const output = await this.pipeline(text, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data);
      })
    );
    return embeddings;
  }

  getDimension() {
    return this.dimension;
  }

  getModelName() {
    return this.modelName;
  }
}
