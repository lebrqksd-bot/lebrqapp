#!/bin/bash
# Production startup script for cPanel deployment
# Auto-detects Python version and starts Gunicorn with optimal settings

set -e

# Detect Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
echo "Detected Python version: $PYTHON_VERSION"

# Set environment
export ENVIRONMENT=production
export LOG_LEVEL=${LOG_LEVEL:-INFO}

# Detect CPU count
CPU_COUNT=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "2")
WORKERS=$((CPU_COUNT * 2 + 1))
# Cap at 4 workers for memory efficiency
if [ $WORKERS -gt 4 ]; then
    WORKERS=4
fi

echo "Starting with $WORKERS workers (CPU count: $CPU_COUNT)"

# Start Gunicorn with Uvicorn workers
exec gunicorn \
    --config gunicorn_config.py \
    --workers $WORKERS \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --graceful-timeout 30 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile - \
    --error-logfile - \
    --log-level ${LOG_LEVEL,,} \
    app.core:app

