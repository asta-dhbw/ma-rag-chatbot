#!/bin/bash
echo "Starting Ollama server..."
/bin/ollama serve &
OLLAMA_PID=$!
echo "Waiting for Ollama service to be ready..."
sleep 5
echo "Ollama service is ready!"
if [ -n "$MODEL_NAME" ]; then
    echo "Checking if model $MODEL_NAME exists..."
    if ! ollama list | grep -q "$MODEL_NAME"; then
        echo "Model not found. Pulling model: $MODEL_NAME"
        ollama pull "$MODEL_NAME"
        echo "Model $MODEL_NAME is ready!"
    else
        echo "Model $MODEL_NAME already exists, skipping download."
    fi
else
    echo "No MODEL_NAME specified, skipping model pull."
fi
echo "Ollama is ready to accept requests."
wait $OLLAMA_PID
