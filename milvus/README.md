# Milvus Vector Database Setup

This directory contains the Docker configuration and initialization scripts for Milvus vector database with a dual-collection architecture.

## Overview

The Milvus setup uses **two collections** for efficient document storage and retrieval:

1. **Chunks Collection** (`test`) - Stores document chunks with embeddings for semantic search
2. **Pages Collection** (`page_with_meta`) - Stores page-level summaries with embeddings for high-level navigation

When the Milvus Docker container starts, it automatically:

1. Starts the Milvus server
2. Creates both collections with optimized schemas
3. Creates HNSW indexes on vector fields
4. Ingests test entities for verification
5. Validates both collections are ready

## Architecture

### Why Two Collections?

**Storage Efficiency**: Page summaries are stored separately from chunks, avoiding duplication. Each page summary is stored once, while chunks reference their parent page via `page_id`.

**Search Flexibility**:
- **Semantic Search**: Query the chunks collection for detailed, granular results
- **Page-Level Search**: Query the pages collection for high-level document navigation
- **Hybrid Approach**: Search pages first, then retrieve relevant chunks from those pages

## Collections

### 1. Chunks Collection (`test`)

Stores document chunks with embeddings for semantic search.

| Field       | Type            | Description                                      |
| ----------- | --------------- | ------------------------------------------------ |
| chunk_id    | Int64           | Primary key (auto_id: false)                     |
| fileID      | VarChar(100)    | Unique file identifier                           |
| filename    | VarChar(255)    | Human-readable filename                          |
| file_hash   | VarChar(32)     | MD5 hash for change detection                    |
| page        | VarChar(200)    | Global page ID (format: `{fileID}_page_{num}`)  |
| chunk_index | Int32           | Chunk position within document (0-based)         |
| chunk_text  | VarChar(8000)   | Actual text content of the chunk                 |
| summary     | VarChar(2000)   | Chunk summary (placeholder/testing)              |
| location    | VarChar(255)    | Document location/URL                            |
| chunk       | FloatVector(384)| Embedding vector (all-MiniLM-L6-v2)              |

**Index Configuration:**
- Type: HNSW
- Metric: COSINE similarity
- Parameters: M=16, efConstruction=200

### 2. Pages Collection (`page_with_meta`)

Stores page-level summaries with embeddings.

| Field              | Type            | Description                                   |
| ------------------ | --------------- | --------------------------------------------- |
| page_id            | VarChar(200)    | Primary key (format: `{fileID}_page_{num}`)   |
| file_id            | VarChar(100)    | Parent file identifier                        |
| local_page_num     | Int32           | Page number within the document (1-based)     |
| summary            | VarChar(500)    | AI-generated page summary (3 bullets + text)  |
| summary_embedding  | FloatVector(384)| Embedding of the summary (all-MiniLM-L6-v2)   |

**Index Configuration:**
- Type: HNSW
- Metric: COSINE similarity
- Parameters: M=16, efConstruction=200

## Files

- `Dockerfile.init` - Custom image for initialization
- `init-milvus.js` - Initialization script (creates collections and test data)
- `milvus-handler.js` - Reusable handler functions and configurations
- `test-ingest.js` - Standalone test ingestion script
- `test-query.js` - Query test script to verify database
- `package.json` - Node.js dependencies

## Usage

### Start the Milvus services

```bash
# Start etcd, minio, and milvus-standalone
docker-compose up -d etcd minio standalone

# Wait for services to be healthy (~30 seconds)
docker-compose ps
```

### Initialize the database

Run the initialization script to create both collections and ingest test data:

```bash
# Run the milvus-init container (automatic on first start)
docker-compose up milvus-init
```

**Expected output:**
```
[1/4] Creating collections...
Creating chunks collection (document chunks)...
✓ Collection and index created successfully

Creating pages collection (page summaries)...
✓ Collection and index created successfully

[2/4] Ingesting test chunk entity...
✓ Successfully ingested 1 test chunk entity

[3/4] Ingesting test page entity...
✓ Successfully ingested 1 test page entity

[4/4] Verifying collections...
✓ Verified: Chunks collection contains 1 entity (as expected)
✓ Verified: Pages collection contains 1 entity (as expected)
```

Or run the initialization manually:

```bash
# Install dependencies (first time only)
cd milvus && npm install

# Run initialization
node init-milvus.js
```

### Verify the database is working

Query both collections to verify functionality:

```bash
cd milvus

# Query chunks collection
node -e "
import('@zilliz/milvus2-sdk-node').then(async ({MilvusClient}) => {
  const client = new MilvusClient({address: 'localhost:19530'});
  await client.loadCollection({collection_name: 'test'});
  const results = await client.query({
    collection_name: 'test',
    expr: 'chunk_id >= 0',
    output_fields: ['fileID', 'filename', 'chunk_text'],
    limit: 5
  });
  console.log('Chunks:', results.data);
  process.exit(0);
})
"

# Query pages collection
node -e "
import('@zilliz/milvus2-sdk-node').then(async ({MilvusClient}) => {
  const client = new MilvusClient({address: 'localhost:19530'});
  await client.loadCollection({collection_name: 'page_with_meta'});
  const results = await client.query({
    collection_name: 'page_with_meta',
    expr: 'local_page_num >= 0',
    output_fields: ['page_id', 'file_id', 'summary'],
    limit: 5
  });
  console.log('Pages:', results.data);
  process.exit(0);
})
"
```

### Rebuild collections from scratch

If you need to drop and recreate the collections:

```bash
# Stop and remove init container
docker-compose rm -f milvus-init

# Rebuild with latest code
docker-compose build milvus-init

# Drop existing collections
docker exec milvus-standalone node -e "
import('@zilliz/milvus2-sdk-node').then(async ({MilvusClient}) => {
  const client = new MilvusClient({address: 'localhost:19530'});
  try { await client.dropCollection({collection_name: 'test'}); console.log('✓ Dropped chunks collection'); } catch(e) {}
  try { await client.dropCollection({collection_name: 'page_with_meta'}); console.log('✓ Dropped pages collection'); } catch(e) {}
  process.exit(0);
})
"

# Run initialization
docker-compose up milvus-init
```

## Configuration

### Environment Variables

The setup uses the following environment variables (defined in `.env` and `docker-compose.yml`):

```bash
# Milvus Connection
MILVUS_HOST=localhost          # (in Docker: milvus-standalone)
MILVUS_PORT=19530

# Collection Names
CHUNKS_COLLECTION_NAME=test
PAGES_COLLECTION_NAME=page_with_meta

# Embedding Model Configuration
EMBEDDING_DIM=384              # all-MiniLM-L6-v2 dimension

# PDF Ingestion
PDF_DIR=./pdf
```

### Using milvus-handler.js

The handler provides clean APIs for collection management:

```javascript
import {
  createCollectionWithIndex,
  ingestData,
  search,
  getCollectionStats,
  COLLECTION_CONFIGS,
} from './milvus-handler.js';

// Create a collection with index
await createCollectionWithIndex(
  COLLECTION_CONFIGS.chunks.name,
  COLLECTION_CONFIGS.chunks.schema,
  COLLECTION_CONFIGS.chunks.indexConfig,
  COLLECTION_CONFIGS.chunks.description,
  true  // dropIfExists
);

// Ingest data
await ingestData(dataArray, COLLECTION_CONFIGS.chunks.name);

// Search
const results = await search(
  queryVector,
  COLLECTION_CONFIGS.chunks.name,
  5  // limit
);

// Get stats
const stats = await getCollectionStats(COLLECTION_CONFIGS.chunks.name);
```

## PDF Ingestion Pipeline

A Python script ingests PDF documents into **both collections**.

### Prerequisites

Install Python dependencies:

```bash
pip install pymilvus langchain-text-splitters sentence-transformers PyPDF2 python-dotenv anthropic
```

### Usage

1. Place PDF files in the `./pdf` directory (relative to project root)
2. Ensure Milvus is running and both collections have been initialized
3. Set `ANTHROPIC_API_KEY` in `.env` for summary generation
4. Run the ingestion script:

```bash
python scripts-milvus/milvus-pdf.py
```

### What It Does

1. **Reads PDFs** from `./pdf` directory
2. **Extracts text** page-by-page
3. **Generates AI summaries** for each page using Claude
4. **Creates embeddings** for both chunks and summaries
5. **Inserts into pages collection** first (with summary embeddings)
6. **Splits into chunks** (1000 chars with 100 char overlap)
7. **Inserts into chunks collection** (with chunk embeddings)
8. **Tracks changes** via MD5 hashing to avoid re-ingesting unchanged files

### Features

- **Automatic chunking**: Splits PDFs into 1000-character chunks with 100-character overlap
- **Page tracking**: Each chunk references its parent page via global `page_id`
- **AI Summaries**: Claude-generated summaries (3 bullets + 2-4 sentences, 300-400 chars)
- **Dual embeddings**: Separate embeddings for chunks and page summaries
- **Deduplication**: Uses MD5 hashing to skip unchanged files
- **Auto-update**: Re-ingests modified PDFs automatically
- **Sequential IDs**: Generates non-conflicting chunk_id values

## Test Entities

### Chunks Test Entity

```javascript
{
  chunk_id: 1,
  fileID: 'TEST_ENTITY_001',
  filename: 'test-document.pdf',
  file_hash: 'd41d8cd98f00b204e9800998ecf8427e',
  page: 1,
  chunk_index: 0,
  chunk_text: 'This is a test chunk of text from the test document.',
  summary: 'Test document summary for verification purposes.',
  location: 'https://drive.google.com/file/d/TEST_ENTITY_001/view',
  chunk: [0.5, 0.5, ..., 0.8, 0.8]  // 192x 0.5, 192x 0.8
}
```

### Pages Test Entity

```javascript
{
  page_id: 'TEST_ENTITY_001_page_1',
  file_id: 'TEST_ENTITY_001',
  local_page_num: 1,
  summary: 'Sample page summary for testing purposes.',
  summary_embedding: [0.3, 0.3, ..., 0.7, 0.7]  // 192x 0.3, 192x 0.7
}
```

## Code Structure

### milvus-handler.js

**Best practices applied:**
- ✅ Configuration objects for all collections
- ✅ Separation of concerns (create vs. index)
- ✅ No hard-coded values
- ✅ Clean, parameterized functions
- ✅ Consistent naming conventions

**Key exports:**
- `createCollection()` - Create a collection
- `createIndex()` - Create an index
- `createCollectionWithIndex()` - Convenience function
- `ingestData()` - Insert data
- `search()` - Semantic search
- `getCollectionStats()` - Get collection info
- `COLLECTION_CONFIGS` - Pre-configured collection definitions

## Troubleshooting

### Collections not created

Make sure environment variables are set correctly:
```bash
docker exec milvus-standalone env | grep MILVUS
```

### Connection refused

Wait for Milvus to be healthy before running init:
```bash
docker-compose ps  # Check health status
```

### Schema mismatch errors

Drop and recreate collections (see "Rebuild collections from scratch" above).

## Next Steps

- Add vector search API endpoint
- Implement hybrid search (pages → chunks)
- Add filtering by fileID or page_id
- Create web interface for PDF uploads
- Add batch ingestion support
