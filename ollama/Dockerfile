FROM ollama/ollama:latest

EXPOSE 11434
ENV OLLAMA_HOST=0.0.0.0

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
