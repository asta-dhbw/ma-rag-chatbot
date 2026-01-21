import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

// Milvus connection configuration
const MILVUS_HOST = process.env.MILVUS_HOST || 'localhost';
const MILVUS_PORT = process.env.MILVUS_PORT || '19530';

const MILVUS_CONFIG = {
  address: `${MILVUS_HOST}:${MILVUS_PORT}`,
  username: process.env.MILVUS_USERNAME,
  password: process.env.MILVUS_PASSWORD,
  ssl: false,
};

// Vector dimension depends on the embedding model used (all-MiniLM-L6-v2)
const VECTOR_DIM = parseInt(process.env.EMBEDDING_DIM || '384', 10);

// Collection names
const CHUNKS_COLLECTION_NAME = process.env.CHUNKS_COLLECTION_NAME || 'test';
const PAGES_COLLECTION_NAME = process.env.PAGES_COLLECTION_NAME || 'page_with_meta';

const CHUNKS_SCHEMA = [
  {
    name: 'chunk_id',
    data_type: DataType.Int64,
    is_primary_key: true,
    auto_id: false,
  },
  { name: 'fileID', data_type: DataType.VarChar, max_length: 100 },
  { name: 'filename', data_type: DataType.VarChar, max_length: 255 },
  { name: 'file_hash', data_type: DataType.VarChar, max_length: 32 }, // MD5 hash
  { name: 'page', data_type: DataType.VarChar, max_length: 200 },
  { name: 'chunk_index', data_type: DataType.Int32 },
  { name: 'chunk_text', data_type: DataType.VarChar, max_length: 8000 },
  { name: 'summary', data_type: DataType.VarChar, max_length: 2000 },
  { name: 'location', data_type: DataType.VarChar, max_length: 255 },
  { name: 'chunk', data_type: DataType.FloatVector, dim: VECTOR_DIM },
];

const PAGES_SCHEMA = [
  {
    name: 'page_id',
    data_type: DataType.VarChar,
    max_length: 200,
    is_primary_key: true,
    auto_id: false,
  },
  { name: 'file_id', data_type: DataType.VarChar, max_length: 100 },
  { name: 'local_page_num', data_type: DataType.Int32 },
  { name: 'summary', data_type: DataType.VarChar, max_length: 500 },
  { name: 'summary_embedding', data_type: DataType.FloatVector, dim: VECTOR_DIM },
];

const CHUNKS_INDEX_CONFIG = {
  field_name: 'chunk',
  index_type: 'HNSW',
  metric_type: 'COSINE',
  params: {
    M: 16,
    efConstruction: 200,
  },
};

const PAGES_INDEX_CONFIG = {
  field_name: 'summary_embedding',
  index_type: 'HNSW',
  metric_type: 'COSINE',
  params: {
    M: 16,
    efConstruction: 200,
  },
};

const COLLECTION_CONFIGS = {
  chunks: {
    name: CHUNKS_COLLECTION_NAME,
    description: 'Collection for document chunks and embeddings',
    schema: CHUNKS_SCHEMA,
    indexConfig: CHUNKS_INDEX_CONFIG,
  },
  pages: {
    name: PAGES_COLLECTION_NAME,
    description: 'Collection for document pages and their summaries',
    schema: PAGES_SCHEMA,
    indexConfig: PAGES_INDEX_CONFIG,
  },
};

let client = null;

/**
 * Get or create the Milvus client connection
 * @returns {MilvusClient} Milvus client instance
 */
function getClient() {
  if (!client) {
    client = new MilvusClient(MILVUS_CONFIG);
  }
  return client;
}

/**
 * Create a collection with the provided schema
 * @param {string} collectionName - Name of the collection
 * @param {Array} schema - Schema definition for the collection
 * @param {string} description - Description of the collection
 * @param {boolean} dropIfExists - Whether to drop the collection if it already exists
 * @returns {Promise<Object>} Result of collection creation
 */
export async function createCollection(
  collectionName,
  schema,
  description = '',
  dropIfExists = false
) {
  const milvusClient = getClient();

  // Check if collection exists
  const hasCollection = await milvusClient.hasCollection({
    collection_name: collectionName,
  });

  if (hasCollection.value) {
    if (dropIfExists) {
      console.log(`Collection '${collectionName}' exists, dropping it...`);
      await milvusClient.dropCollection({
        collection_name: collectionName,
      });
    } else {
      console.log(`Collection '${collectionName}' already exists.`);
      return { success: true, message: 'Collection already exists' };
    }
  }

  // Create collection
  console.log(`Creating collection '${collectionName}'...`);
  await milvusClient.createCollection({
    collection_name: collectionName,
    description: description,
    fields: schema,
  });

  console.log(`Collection '${collectionName}' created successfully.`);
  return { success: true, message: 'Collection created successfully' };
}

/**
 * Create an index on a collection's vector field
 * @param {string} collectionName - Name of the collection
 * @param {Object} indexConfig - Index configuration object
 * @returns {Promise<Object>} Result of index creation
 */
export async function createIndex(collectionName, indexConfig) {
  const milvusClient = getClient();

  console.log(`Creating index on '${indexConfig.field_name}' field in '${collectionName}'...`);
  await milvusClient.createIndex({
    collection_name: collectionName,
    ...indexConfig,
  });

  console.log(`Index created successfully on '${collectionName}'.`);
  return { success: true, message: 'Index created successfully' };
}

/**
 * Create a collection with its index in one call (convenience function)
 * @param {string} collectionName - Name of the collection
 * @param {Array} schema - Schema definition
 * @param {Object} indexConfig - Index configuration
 * @param {string} description - Collection description
 * @param {boolean} dropIfExists - Whether to drop if exists
 * @returns {Promise<Object>} Result of creation
 */
export async function createCollectionWithIndex(
  collectionName,
  schema,
  indexConfig,
  description = '',
  dropIfExists = false
) {
  const createResult = await createCollection(
    collectionName,
    schema,
    description,
    dropIfExists
  );

  if (!createResult.success) {
    return createResult;
  }

  // Only create index if collection was actually created (not if it already existed)
  if (createResult.message !== 'Collection already exists') {
    const indexResult = await createIndex(collectionName, indexConfig);
    if (!indexResult.success) {
      return indexResult;
    }
  }

  return { success: true, message: 'Collection and index created successfully' };
}

/**
 * Ingest data into the collection
 * @param {Array<Object>} data - Array of data objects matching the schema
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Object>} Result of data insertion
 */
export async function ingestData(data, collectionName) {
  const milvusClient = getClient();

  // Validate data
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array');
  }

  // Insert data
  console.log(`Inserting ${data.length} records into '${collectionName}'...`);
  const insertRes = await milvusClient.insert({
    collection_name: collectionName,
    data: data,
  });

  // Flush to ensure data is persisted
  console.log('Flushing data...');
  await milvusClient.flush({
    collection_names: [collectionName],
  });

  // Load collection into memory if not already loaded
  console.log('Loading collection into memory...');
  await milvusClient.loadCollection({
    collection_name: collectionName,
  });

  // Wait for collection to be fully loaded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`Successfully ingested ${data.length} records.`);
  return {
    success: true,
    insertCount: insertRes.insert_cnt || data.length,
    message: 'Data ingested successfully',
  };
}

/**
 * Search for similar vectors in the collection
 * @param {Array<number>} queryVector - Query vector for similarity search
 * @param {string} collectionName - Name of the collection
 * @param {number} limit - Maximum number of results to return
 * @param {Array<string>} outputFields - Fields to include in the results
 * @param {string} metricType - Metric type for similarity (default: COSINE)
 * @returns {Promise<Object>} Search results
 */
export async function search(
  queryVector,
  collectionName,
  limit = 5,
  outputFields = ['fileID', 'filename', 'page', 'chunk_index', 'chunk_text', 'summary', 'location'],
  metricType = 'COSINE'
) {
  const milvusClient = getClient();

  // Validate query vector
  if (!Array.isArray(queryVector) || queryVector.length !== VECTOR_DIM) {
    throw new Error(`Query vector must be an array of length ${VECTOR_DIM}`);
  }

  console.log(`Searching in '${collectionName}'...`);
  const results = await milvusClient.search({
    collection_name: collectionName,
    vector: queryVector,
    limit: limit,
    metric_type: metricType,
    params: { ef: 64 },
    output_fields: outputFields,
  });

  console.log(`Found ${results.results?.length || 0} results.`);
  return results;
}

/**
 * Get collection statistics
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Object>} Collection statistics
 */
export async function getCollectionStats(collectionName) {
  const milvusClient = getClient();

  const stats = await milvusClient.getCollectionStatistics({
    collection_name: collectionName,
  });

  return stats;
}

/**
 * Close the Milvus client connection
 */
export async function closeConnection() {
  if (client) {
    await client.closeConnection();
    client = null;
    console.log('Milvus connection closed.');
  }
}

export {
  // Connection config
  MILVUS_CONFIG,
  VECTOR_DIM,

  // Collection names
  CHUNKS_COLLECTION_NAME,
  PAGES_COLLECTION_NAME,

  // Schemas
  CHUNKS_SCHEMA,
  PAGES_SCHEMA,

  // Index configs
  CHUNKS_INDEX_CONFIG,
  PAGES_INDEX_CONFIG,

  // Collection configurations (all-in-one)
  COLLECTION_CONFIGS,
};
