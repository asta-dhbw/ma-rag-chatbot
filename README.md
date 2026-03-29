# StuV-Copilot

AI-powered document Q&A chatbot for DHBW students. Built with Next.js, Milvus vector database, and Claude/Ollama LLMs.

## Capabilities

- **Document Q&A**: Ask questions about ingested PDF documents
- **Semantic Search**: Find relevant information using vector similarity search
- **AI Summaries**: Automatic page-level summaries for quick navigation
- **Dual Authentication**: Google OAuth (development) + Keycloak (production/DHBW SSO)
- **Hybrid LLM Support**: Claude API (cloud) or Ollama (local)
- **Google Drive Integration**: Access documents via MCP (Model Context Protocol)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐              ┌──────────────────────────────────────┐    │
│   │    User      │              │           Auth Providers              │    │
│   │   Browser    │─────────────▶│  ┌────────────┐  ┌────────────────┐  │    │
│   └──────────────┘              │  │   Google   │  │    Keycloak    │  │    │
│          │                      │  │   OAuth    │  │   (DHBW SSO)   │  │    │
│          │                      │  └────────────┘  └────────────────┘  │    │
│          │                      └──────────────────────────────────────┘    │
│          │                                    │                              │
│          ▼                                    ▼                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                              APPLICATION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                      Next.js Frontend                             │      │
│   │                     (Port 3000 / 80)                              │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│          │                         │                         │               │
│          ▼                         ▼                         ▼               │
│   ┌────────────┐           ┌────────────┐           ┌────────────────┐      │
│   │   Claude   │           │   Milvus   │           │  Google Drive  │      │
│   │    API     │           │  (Vector)  │           │     (MCP)      │      │
│   └────────────┘           └────────────┘           └────────────────┘      │
│          │                         │                                         │
│          │                         │                                         │
│          ▼                         ▼                                         │
│   ┌────────────┐           ┌────────────┐                                   │
│   │   Ollama   │           │   MinIO    │                                   │
│   │   (Local)  │           │  (Storage) │                                   │
│   └────────────┘           └────────────┘                                   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           PDF INGESTION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐   │
│   │    PDF     │────▶│   PyPDF2   │────▶│  Chunking  │────▶│ Embeddings │   │
│   │   Files    │     │  (Extract) │     │ (1000char) │     │  (OpenAI/  │   │
│   └────────────┘     └────────────┘     └────────────┘     │   Local)   │   │
│                                                │           └────────────┘   │
│                                                │                  │          │
│                                                ▼                  ▼          │
│                                         ┌────────────┐     ┌────────────┐   │
│                                         │   Claude   │     │   Milvus   │   │
│                                         │ (Summaries)│────▶│ (2 Colls)  │   │
│                                         └────────────┘     └────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/              # Authentication endpoints
│   │   │   │   ├── authorize/     # Google OAuth start
│   │   │   │   ├── callback/      # Google OAuth callback
│   │   │   │   ├── check/         # Google auth status
│   │   │   │   └── keycloak/      # Keycloak OAuth endpoints
│   │   │   │       ├── authorize/ # Keycloak OAuth start
│   │   │   │       ├── callback/  # Keycloak OAuth callback
│   │   │   │       └── check/     # Keycloak auth status
│   │   │   ├── claude/            # Claude API endpoint
│   │   │   ├── milvus/            # Milvus search endpoint
│   │   │   └── ollama/            # Ollama LLM endpoint
│   │   ├── chat/                  # Protected chat page
│   │   └── oauth/                 # Login page
│   ├── components/                # React components
│   └── lib/                       # Shared utilities
├── scripts-milvus/                # Python PDF ingestion (see scripts-milvus/README.md)
├── milvus/                        # Milvus init scripts (see milvus/README.md)
├── ollama/                        # Ollama Docker setup (see ollama/README.md)
├── pdf/                           # PDF files for ingestion
├── docker-compose.yml             # All Docker services
└── .env                           # Environment configuration
```

## Local Development Setup

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- Python 3.x (for PDF ingestion)

### Step 1: Clone & Install Dependencies

```bash
git clone <repository-url>
cd mcp-js-example-testinggrounds
npm install
```

### Step 2: Configure Environment

Create `.env` in project root:

```env
# =============================================================================
# API KEYS
# =============================================================================
ANTHROPIC_API_KEY="sk-ant-..."        # Required for Claude (chat + summaries)
OPENAI_API_KEY="sk-proj-..."          # Required for OpenAI embeddings

# =============================================================================
# AUTHENTICATION
# =============================================================================
# Auth providers: "google", "keycloak", or "google,keycloak" for both
NEXT_PUBLIC_AUTH_PROVIDERS="google,keycloak"

# Keycloak Configuration (for DHBW SSO)
KEYCLOAK_CLIENT_ID="ma-website-chattest"
KEYCLOAK_CLIENT_SECRET="your-secret-here"
KEYCLOAK_ISSUER="https://keycloak.dhbw-asta.de/realms/de.dhbw.asta"

# Base URL (change for production)
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# =============================================================================
# MILVUS VECTOR DATABASE
# =============================================================================
MILVUS_HOST="localhost"
MILVUS_PORT="19530"
CHUNKS_COLLECTION_NAME="test"
PAGES_COLLECTION_NAME="page_with_meta"

# =============================================================================
# EMBEDDINGS
# =============================================================================
# Provider: "openai" (paid, 1536D) or "local" (free, 384D)
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIM=1536

# =============================================================================
# FILE PATHS
# =============================================================================
PDF_DIR="C:\\path\\to\\project\\pdf"
LOCAL_FILE_PATH="C:\\path\\to\\project\\data"
```

### Step 3: Start Docker Services

```bash
# Start all services (Milvus + Ollama)
docker-compose up -d

# Wait for services to be healthy (~60 seconds)
docker-compose ps

# Check Milvus health
curl http://localhost:9091/healthz
```

### Step 4: Ingest PDFs (Optional)

```bash
# Place PDFs in ./pdf folder, then:
cd scripts-milvus
pip install -r requirements.txt
python milvus-pdf.py
```

See [`scripts-milvus/README.md`](./scripts-milvus/README.md) for details.

### Step 5: Configure Google OAuth (Development)

1. Create `client_secret.json` in project root (from Google Cloud Console)
2. Set redirect URI in Google Console: `http://localhost:3000/api/auth/callback`

### Step 6: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Documentation Index

Read in this order for full understanding:

| # | Document | Description |
|---|----------|-------------|
| 1 | This README | Overview, setup, architecture |
| 2 | [`scripts-milvus/README.md`](./scripts-milvus/README.md) | PDF ingestion, embeddings, models |
| 3 | [`milvus/README.md`](./milvus/README.md) | Vector database schema, collections |
| 4 | [`ollama/README.md`](./ollama/README.md) | Local LLM setup |

## Production Deployment

### Technical Details

| Setting | Value |
|---------|-------|
| **Domain** | `chat-test.stuv-mannheim.de` |
| **VM IP** | `10.32.39.247` |
| **Container Port** | `80` |
| **Reverse Proxy** | `chat-test.stuv-mannheim.de` -> `10.32.39.247:80` |

### Environment Changes for Production

```env
# Production auth (Keycloak only)
NEXT_PUBLIC_AUTH_PROVIDERS="keycloak"
NEXT_PUBLIC_BASE_URL="https://chat-test.stuv-mannheim.de"

# Keycloak redirect URI must be configured:
# https://chat-test.stuv-mannheim.de/api/auth/keycloak/callback
```

### Docker Production Build

```bash
# Build production image
docker build -t stuv-copilot .

# Run on port 80
docker run -d -p 80:3000 --env-file .env stuv-copilot
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/authorize` | GET | Start Google OAuth |
| `/api/auth/callback` | GET | Google OAuth callback |
| `/api/auth/check` | GET | Check Google auth status |
| `/api/auth/keycloak/authorize` | GET | Start Keycloak OAuth |
| `/api/auth/keycloak/callback` | GET | Keycloak OAuth callback |
| `/api/auth/keycloak/check` | GET | Check Keycloak auth status |
| `/api/claude` | POST | Chat with Claude API |
| `/api/milvus` | POST | Vector search |
| `/api/ollama` | POST | Chat with local Ollama |

## Troubleshooting

### Milvus Connection Issues

```bash
docker-compose ps                    # Check status
docker logs milvus-standalone        # Check logs
docker-compose restart standalone    # Restart
```

### Authentication Issues

```bash
# Check token files exist
ls token.json           # Google
ls keycloak-token.json  # Keycloak

# Clear tokens to force re-auth
rm token.json keycloak-token.json
```

### PDF Ingestion Issues

```bash
# Check Milvus is running
curl http://localhost:9091/healthz

# Check PDF folder path in .env
echo $PDF_DIR
```

## Known Issues & TODO

### Performance
- [ ] Reduce response time with RAG-first architecture
- [ ] Optimize vector search parameters

### Features
- [ ] Web interface for PDF uploads
- [ ] Multi-tenant support (different groups see different documents)
- [ ] Document deletion/update UI

### Production
- [x] Add Keycloak authentication
- [ ] Implement rate limiting
- [ ] Add monitoring and logging
- [ ] Set up CI/CD pipeline

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## License

MIT
