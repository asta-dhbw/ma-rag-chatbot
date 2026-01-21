import OpenAI from 'openai';
import { EmbeddingProvider } from './base.js';

export class OpenAIEmbeddingProvider extends EmbeddingProvider {
  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimension = parseInt(process.env.EMBEDDING_DIM || '1536', 10);

    console.log(`Initialized OpenAI provider: ${this.model} (${this.dimension}D)`);
  }

  async generateEmbedding(text) {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async generateEmbeddings(texts) {
    // OpenAI supports up to 2048 texts per request
    const batchSize = 2000;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });

      const embeddings = response.data.map(item => item.embedding);
      allEmbeddings.push(...embeddings);

      console.log(`Generated ${embeddings.length} embeddings (${i + batch.length}/${texts.length})`);
    }

    return allEmbeddings;
  }

  getDimension() {
    return this.dimension;
  }

  getModelName() {
    return this.model;
  }
}
