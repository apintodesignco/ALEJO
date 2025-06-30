FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama for local LLM support
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data/emotional \
    && mkdir -p /root/.alejo

# Copy the application
COPY . .

# Set up default configuration
COPY config/default_config.json /root/.alejo/config.json

# Environment variables
ENV PYTHONPATH=/app
ENV ALEJO_CONFIG=/root/.alejo/config.json

# Expose ports for Ollama API and ALEJO API
EXPOSE 11434
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["python", "-m", "alejo.services.brain_service"]
