#!/bin/bash
# Optimized server startup script with memory limits
# Usage: ./start_server_optimized.sh

# Set memory limit (adjust based on your server RAM)
# For 1GB server: 400MB, For 2GB server: 800MB
ulimit -v 419430  # 400MB in KB - adjust as needed

# Python memory optimizations
export PYTHONHASHSEED=0
export PYTHONUNBUFFERED=1
export MALLOC_ARENA_MAX=2

# Database pool settings (override defaults)
export DB_POOL_SIZE=2
export DB_MAX_OVERFLOW=2

# Navigate to backend directory (adjust path)
cd /home/taxtower/lebrq_api || cd "$(dirname "$0")/.."

# Activate virtual environment (adjust path)
source myenv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null

# Start server with optimized settings
echo "Starting server with memory optimizations..."
uvicorn app.core:app \
  --host 0.0.0.0 \
  --port 8002 \
  --ssl-keyfile=/var/cpanel/ssl/apache_tls/taxtower.in/key.pem \
  --ssl-certfile=/var/cpanel/ssl/apache_tls/taxtower.in/cert.pem \
  --limit-concurrency 30 \
  --timeout-keep-alive 5 \
  --backlog 1024 \
  --workers 1 \
  --log-level info

