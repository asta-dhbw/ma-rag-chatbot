# Ollama Integration with GPT-OSS 20B

This directory contains the Docker setup for running Ollama with the GPT-OSS 20B model.

## Prerequisites

- Docker
- Docker Compose

## Setup

1. Make sure you're in the project root directory
2. Start the Ollama container:

```bash
docker-compose up -d
```

This will:
- Build the Ollama Docker image
- Start the Ollama server on port 11434
- Automatically pull the `llama3.1:8b` model (this may take a while on first run 13GB)
- Persist the model data in a Docker volume

## Usage

The Ollama API is accessible at `http://localhost:11434` by default.

The Next.js app can communicate with it via the `/api/ollama` endpoint.

## Monitoring

Check the logs to see the model download progress:

```bash
docker-compose logs -f ollama
```

Check if the model is ready (curl or copy to browser):

```bash
curl http://localhost:11434/api/tags
```

## Stopping

```bash
docker-compose down
```

To also remove the model data volume (to not install 13GB every time you restart the project):

```bash
docker-compose down -v
```

## Environment Variables

Customize the Ollama URL in your Next.js app by setting:

```
OLLAMA_URL=http://localhost:11434
```

## Model Configuration

The model is hardcoded to `gpt-oss:20b` in:
- `docker-compose.yml` (MODEL_NAME environment variable)
- `app/api/ollama/route.js` (API route)

To change the model, update both files.
