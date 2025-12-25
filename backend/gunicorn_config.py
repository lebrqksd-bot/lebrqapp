"""
Gunicorn configuration for production deployment on cPanel.

This configuration is optimized for memory efficiency and high concurrency.
Auto-detects CPU count and adjusts workers accordingly.
"""

import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# Worker processes
# Auto-detect CPU count, but cap at 4 for memory efficiency
cpu_count = multiprocessing.cpu_count()
workers = min(cpu_count * 2 + 1, 4)  # Cap at 4 workers to prevent memory exhaustion
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 120  # 2 minutes for long-running requests
keepalive = 5

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = os.getenv("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "lebrq-api"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Worker timeout and graceful shutdown
graceful_timeout = 30
worker_tmp_dir = "/dev/shm"  # Use shared memory for worker temp files (if available)

# Memory optimization
max_requests = 1000  # Restart worker after 1000 requests to prevent memory leaks
max_requests_jitter = 50  # Add randomness to prevent all workers restarting at once

def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info(f"Starting Gunicorn with {workers} workers (CPU count: {cpu_count})")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading workers...")

def worker_int(worker):
    """Called when a worker receives INT or QUIT signal."""
    worker.log.info("Worker received INT/QUIT signal")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker spawned (pid: {worker.pid})")

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info("Worker initialized")

def worker_abort(worker):
    """Called when a worker times out."""
    worker.log.warning("Worker aborted due to timeout")

