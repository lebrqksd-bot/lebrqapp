FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL and async operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Cloud Run specific settings
ENV PORT=8080
EXPOSE 8080

# Run the app using main.py entry point (which handles uvicorn setup)
# main.py will read PORT env var automatically
CMD ["python", "main.py"]
