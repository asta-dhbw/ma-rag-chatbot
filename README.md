# Next.js + Milvus Vector Database + Ollama LLM

This is a [Next.js](https://nextjs.org) project with integrated Milvus vector database and Ollama LLM support for document-based Q&A.

## Prerequisites

- Node.js (v18 or higher)
- Docker & Docker Compose
- Python 3.x (for PDF ingestion)

## Project Structure

```
.
├── /milvus              # Vector database setup and JavaScript handlers
├── /scripts-milvus      # Python PDF ingestion scripts
├── /ollama              # Ollama LLM setup
├── /src/app             # Next.js application
│   └── /api/milvus      # Milvus API routes
├── /src/lib             # Shared libraries and utilities
├── .env                 # Environment configuration
└── docker-compose.yml   # Docker services configuration
```

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Anthropic API Configuration (for PDF summaries)
ANTHROPIC_API_KEY=your_api_key_here

# Local File Paths
LOCAL_FILE_PATH="C:\\path\\to\\your\\data"
PDF_DIR="./pdf"

# Milvus Connection
MILVUS_HOST="localhost"
MILVUS_PORT="19530"

# Milvus Collections
CHUNKS_COLLECTION_NAME="test"
PAGES_COLLECTION_NAME="page_with_meta"

# Embedding Configuration
EMBEDDING_DIM=384  # all-MiniLM-L6-v2 dimension
```

These are automatically loaded by both JavaScript and Python scripts.

## Quick Start

### 1. Start the Next.js Development Server

```bash
npm install
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

### 2. Start Milvus Vector Database

**Start all services:**

```bash
docker-compose up -d
```

**Wait for services to be healthy (~30-60 seconds):**

```bash
docker-compose ps
```

**The `milvus-init` container runs automatically and:**
- Creates two collections (`test` and `page_with_meta`)
- Creates HNSW indexes on vector fields
- Ingests test entities for verification
- Validates both collections are ready

For detailed Milvus documentation, see [`./milvus/README.md`](./milvus/README.md).

## Milvus Vector Database

### Dual-Collection Architecture

The project uses **two Milvus collections** for efficient document storage:

1. **Chunks Collection** (`test`)
   - Stores document chunks with embeddings
   - Used for detailed semantic search
   - 1000-character chunks with 100-character overlap

2. **Pages Collection** (`page_with_meta`)
   - Stores page-level summaries with embeddings
   - Used for high-level navigation
   - AI-generated summaries (Claude)

### Why Two Collections?

- **Storage Efficiency**: Page summaries stored once, not duplicated across chunks
- **Search Flexibility**: Query pages for overview, chunks for details
- **Hybrid Search**: Find relevant pages first, then retrieve specific chunks

### Collections Schema

**Chunks Collection:**
- chunk_id (primary key)
- fileID, filename, file_hash
- page (references page_id in pages collection)
- chunk_index, chunk_text
- location
- chunk (384-dim vector)

**Pages Collection:**
- page_id (primary key)
- file_id, local_page_num
- summary (AI-generated)
- summary_embedding (384-dim vector)

## PDF Ingestion Pipeline

Ingest PDF documents into both Milvus collections.

### Prerequisites

Install Python dependencies:

```bash
pip install pymilvus langchain-text-splitters sentence-transformers PyPDF2 python-dotenv anthropic
```

### Usage

1. Place PDF files in the `./pdf` directory
2. Ensure Milvus is running (`docker-compose up -d`)
3. Set `ANTHROPIC_API_KEY` in `.env` for summary generation
4. Run the ingestion script:

```bash
python scripts-milvus/milvus-pdf.py
```

### What It Does

1. Reads PDFs from `./pdf` directory
2. Extracts text page-by-page
3. Generates AI summaries for each page (using Claude)
4. Creates embeddings for summaries and chunks
5. Inserts page summaries into `page_with_meta` collection
6. Splits text into chunks and inserts into `test` collection
7. Tracks changes via MD5 hashing to avoid re-processing

### Features

- **Automatic chunking**: 1000 chars with 100 char overlap
- **Page tracking**: Global page_id format: `{fileID}_page_{num}`
- **AI Summaries**: Claude-generated (3 bullets + 2-4 sentences, 300-400 chars)
- **Dual embeddings**: Separate vectors for chunks and summaries
- **Deduplication**: MD5 hash-based change detection
- **Auto-update**: Re-ingests modified PDFs automatically
- **Sequential IDs**: Non-conflicting chunk_id generation

## Ollama LLM Integration

Run local LLMs with Ollama for document Q&A.

### Prerequisites

- Docker

### Setup

Follow the instructions in [`./ollama/README.md`](./ollama/README.md) to:
1. Start Ollama service via Docker
2. Download the model (e.g., `qwen2.5:3b`)
3. Configure the Next.js app to use Ollama

### Usage

Once Ollama is running:

```bash
npm run dev
```

Chat with your documents through the web interface. The system:
1. Queries Milvus for relevant chunks/pages
2. Sends context + query to Ollama
3. Streams the LLM response back

**Note**: Response times are currently 30-40 seconds depending on model and hardware.

## API Routes

### Milvus Search API

**Endpoint**: `/api/milvus`

**Example:**

```javascript
const response = await fetch('/api/milvus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'search',
    query: 'What is machine learning?',
    limit: 5
  })
});

const results = await response.json();
```

## Development Notes

This project uses:
- [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to optimize [Geist](https://vercel.com/font) font
- Milvus SDK (`@zilliz/milvus2-sdk-node`)
- SentenceTransformers (`all-MiniLM-L6-v2`) for embeddings
- Claude API for summary generation

## Known Issues & TODO

### Performance

- [ ] Reduce response time by implementing RAG-first architecture
- [ ] Reduce response time with Agent-to-Agent (A2A) for efficient context extension
- [ ] Optimize vector search parameters for faster retrieval

### Features To Add

- [ ] Multi-tenant support (different groups see different document sets)
- [x] CLI tool for PDF uploads (`scripts-milvus/milvus-pdf.py`)
- [ ] Web interface for PDF uploads (currently CLI only)
- [ ] Hybrid search (pages → chunks)
- [ ] Filtering by fileID or date range
- [ ] Batch ingestion support
- [ ] Document deletion/update UI

### Production Considerations

- [ ] Change application type (from desktop-app to webapp)
- [ ] Update MCP transport (from stdio to HTTP) depending on deployment architecture
- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add monitoring and logging
- [ ] Set up CI/CD pipeline

## Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Milvus     │────▶│  Ollama LLM │
│   Frontend  │     │  (2 colls)   │     │   (Local)   │
└─────────────┘     └──────────────┘     └─────────────┘
      │                    │
      │                    │
      ▼                    ▼
┌─────────────┐     ┌──────────────┐
│  PDF Upload │     │   Sentence   │
│   Pipeline  │────▶│  Transformer │
└─────────────┘     │  (Embedding) │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Claude    │
                    │  (Summaries) │
                    └──────────────┘
```

## Troubleshooting

### Milvus connection issues

```bash
# Check if Milvus is healthy
docker-compose ps

# Check Milvus logs
docker logs milvus-standalone

# Restart Milvus
docker-compose restart standalone
```

### Collections not found

```bash
# Rebuild collections from scratch
docker-compose rm -f milvus-init
docker-compose build milvus-init
docker-compose up milvus-init
```

### Python dependencies

```bash
# If PDF ingestion fails, ensure all deps are installed
pip install -r requirements.txt  # if you have one, or:
pip install pymilvus langchain-text-splitters sentence-transformers PyPDF2 python-dotenv anthropic
```

## Learn More

**Next.js:**
- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

**Milvus:**
- [Milvus Documentation](https://milvus.io/docs)
- [Milvus SDK Node.js](https://github.com/milvus-io/milvus-sdk-node)

**Ollama:**
- [Ollama Documentation](https://ollama.ai/docs)
- [Ollama Models](https://ollama.ai/library)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

**Note:** You'll need to deploy Milvus separately (e.g., Zilliz Cloud, AWS, GCP) and update connection settings.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
