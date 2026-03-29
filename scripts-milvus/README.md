# Milvus PDF Ingestion

This folder contains scripts for ingesting PDF documents into Milvus vector database.

## Models Used

### Summary Generation
- **Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Purpose:** Generates concise summaries for each PDF page
- **Rate Limits:** [Anthropic Rate Limits](https://docs.anthropic.com/en/api/rate-limits)

### Embeddings
Configurable via `EMBEDDING_PROVIDER` environment variable:

| Provider | Model | Dimensions | Cost |
|----------|-------|------------|------|
| `openai` | `text-embedding-3-small` | 1536 | Paid |
| `local` | `all-MiniLM-L6-v2` | 384 | Free |

- **OpenAI Rate Limits:** [OpenAI Models Documentation](https://platform.openai.com/docs/models/embeddings)

## Files Overview

### `milvus-pdf.py`
Main ingestion script. Functions:

| Function | Description |
|----------|-------------|
| `get_pdf_hash()` | Creates MD5 hash of PDF to detect content changes |
| `load_and_split_pdf()` | Extracts text from PDF, splits into chunks (~1000 chars) |
| `get_existing_hashes()` | Queries Milvus for already ingested file hashes |
| `get_existing_page_ids()` | Queries Milvus for already processed page IDs |
| `get_max_chunk_id()` | Gets highest chunk ID for auto-increment |
| `insert_embeddings()` | Inserts chunk vectors into Milvus |
| `insert_page_summaries()` | Generates summaries via Claude API and inserts into Milvus |
| `write_summary()` | Calls Claude Haiku API to summarize a PDF page |
| `main()` | Orchestrates the ingestion pipeline |

### `embeddings/` Folder
Pluggable embedding provider system. Allows switching between paid (OpenAI) and free (local) embeddings.

| File | Description |
|------|-------------|
| `__init__.py` | Factory function `get_embedding_provider()` - returns provider based on env config |
| `base.py` | Abstract base class `EmbeddingProvider` defining the interface |
| `openai_provider.py` | OpenAI API implementation (paid, high quality, 1536D) |
| `local_provider.py` | Local sentence-transformers implementation (free, runs on CPU, 384D) |

## Configuration

Set in `.env`:

```env
# Embedding provider: "openai" (paid) or "local" (free)
EMBEDDING_PROVIDER="openai"

# Model settings (defaults shown)
EMBEDDING_MODEL="text-embedding-3-small"  # or "all-MiniLM-L6-v2" for local
EMBEDDING_DIM=1536                         # or 384 for local

# Milvus connection
MILVUS_HOST="localhost"
MILVUS_PORT="19530"

# Collections
CHUNKS_COLLECTION_NAME="test"
PAGES_COLLECTION_NAME="page_with_meta"

# PDF source directory
PDF_DIR="C:\\path\\to\\pdf\\folder"
```

## Usage

```bash
# Activate venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Run ingestion
python milvus-pdf.py
```

The script automatically:
- Skips unchanged PDFs (hash comparison)
- Updates modified PDFs (deletes old, inserts new)
- Handles encoding issues on Windows
