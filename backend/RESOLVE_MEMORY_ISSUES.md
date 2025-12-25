# How to Resolve Memory Issues on Live Server


## 🔧 Server-Level Solutions

### 1. **Check Current Memory Usage**

SSH into your server and run:
```bash
# Check total memory
free -h

# Check Python process memory
ps aux | grep uvicorn | grep -v grep

# Check memory usage over time
top -p $(pgrep -f uvicorn)
```

### 2. **Restart Server with Memory Limits**

Create a startup script with memory limits:

```bash
#!/bin/bash
# File: start_server.sh

# Set memory limit (adjust based on your server RAM)
# For 1GB server: 400MB limit
# For 2GB server: 800MB limit
ulimit -v 419430  # 400MB in KB (1GB server)
# ulimit -v 819200  # 800MB in KB (2GB server)

# Navigate to backend directory
cd /home/taxtower/lebrq_api

# Activate virtual environment
source myenv/bin/activate

# Start server with optimized settings
uvicorn app.core:app \
  --host 0.0.0.0 \
  --port 8002 \
  --ssl-keyfile=/var/cpanel/ssl/apache_tls/taxtower.in/key.pem \
  --ssl-certfile=/var/cpanel/ssl/apache_tls/taxtower.in/cert.pem \
  --limit-concurrency 30 \
  --timeout-keep-alive 5 \
  --backlog 1024 \
  --workers 1
```

**Make it executable:**
```bash
chmod +x start_server.sh
```

### 3. **Use Nginx for SSL Termination** (BEST SOLUTION)

This is the **most effective** way to reduce memory usage.

**Nginx Configuration:**
```nginx
# /etc/nginx/conf.d/taxtower.conf

upstream lebrq_backend {
    server 127.0.0.1:8002;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name taxtower.in;

    ssl_certificate /var/cpanel/ssl/apache_tls/taxtower.in/cert.pem;
    ssl_certificate_key /var/cpanel/ssl/apache_tls/taxtower.in/key.pem;

    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Buffer sizes (reduce memory)
    client_body_buffer_size 128k;
    client_max_body_size 20m;
    client_body_timeout 30s;

    location / {
        proxy_pass http://lebrq_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Then run uvicorn WITHOUT SSL:**
```bash
uvicorn app.core:app --host 127.0.0.1 --port 8002 --workers 1
```

**Reload Nginx:**
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 4. **Reduce Database Pool Further** (If Still Having Issues)

Edit `backend/app/db.py` or set environment variables:

```bash
# In .env or cPanel environment
export DB_POOL_SIZE=2
export DB_MAX_OVERFLOW=2
```

Or modify `backend/app/db.py`:
```python
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "2"))  # Reduced to 2
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "2"))  # Reduced to 2
```

### 5. **Increase Garbage Collection Frequency**

Edit `backend/app/core.py` (line 612):
```python
time.sleep(45)  # Every 45 seconds instead of 60
```

### 6. **Add System Swap Space** (If Server Allows)

```bash
# Check current swap
free -h

# Create 1GB swap file (if no swap exists)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 7. **Monitor and Auto-Restart on High Memory**

Create a monitoring script:

```bash
#!/bin/bash
# File: monitor_memory.sh

MAX_MEMORY_MB=400
CHECK_INTERVAL=60

while true; do
    PID=$(pgrep -f "uvicorn app.core:app")
    if [ -z "$PID" ]; then
        echo "Server not running, starting..."
        /path/to/start_server.sh
        sleep 10
        continue
    fi
    
    MEMORY_MB=$(ps -p $PID -o rss= | awk '{print $1/1024}')
    
    if (( $(echo "$MEMORY_MB > $MAX_MEMORY_MB" | bc -l) )); then
        echo "Memory exceeded ${MAX_MEMORY_MB}MB: ${MEMORY_MB}MB - Restarting server..."
        kill $PID
        sleep 5
        /path/to/start_server.sh
    fi
    
    sleep $CHECK_INTERVAL
done
```

**Run as background service:**
```bash
nohup ./monitor_memory.sh > monitor.log 2>&1 &
```

### 8. **Optimize Python Memory Settings**

Add to your startup script:
```bash
export PYTHONHASHSEED=0
export PYTHONUNBUFFERED=1
export MALLOC_ARENA_MAX=2  # Reduce memory fragmentation
```

### 9. **Use systemd Service with Memory Limits**

Create `/etc/systemd/system/lebrq-api.service`:

```ini
[Unit]
Description=LebrQ API Server
After=network.target

[Service]
Type=simple
User=taxtower
WorkingDirectory=/home/taxtower/lebrq_api
Environment="PATH=/home/taxtower/lebrq_api/myenv/bin"
ExecStart=/home/taxtower/lebrq_api/myenv/bin/uvicorn app.core:app --host 127.0.0.1 --port 8002
Restart=always
RestartSec=10

# Memory limits
MemoryMax=500M
MemoryHigh=400M

# CPU limits
CPUQuota=100%

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable lebrq-api
sudo systemctl start lebrq-api
sudo systemctl status lebrq-api
```

### 10. **Check for Memory Leaks**

```bash
# Monitor memory over time
watch -n 5 'ps aux | grep uvicorn | grep -v grep | awk "{print \$6/1024 \" MB\"}"'

# Check for memory leaks in logs
grep -i "memory" /path/to/logs/*.log
```

## 🚀 Quick Fix Checklist

### Immediate Actions (Do These First):

1. ✅ **Restart server** to apply code changes
2. ✅ **Check memory usage**: `free -h` and `ps aux | grep uvicorn`
3. ✅ **Set up Nginx for SSL** (if possible) - **BIGGEST IMPACT**
4. ✅ **Reduce DB pool to 2** if memory is very limited
5. ✅ **Increase GC frequency to 45 seconds**

### If Issues Persist:

6. ✅ **Add swap space** (1GB minimum)
7. ✅ **Set up systemd service** with memory limits
8. ✅ **Monitor memory** and auto-restart if needed
9. ✅ **Check for memory leaks** in logs

## 📊 Expected Memory Usage

| Component | Memory Usage |
|-----------|--------------|
| Base Python | ~50-80MB |
| FastAPI/Uvicorn | ~30-50MB |
| Database Pool (3 conn) | ~30-60MB |
| SSL Connections | ~20-40MB per connection |
| **Total (Normal)** | **~150-250MB** |
| **Total (Under Load)** | **~300-500MB** |

## 🔍 Diagnostic Commands

```bash
# Check current memory
free -h

# Check Python process
ps aux | grep python | grep uvicorn

# Check database connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Check SSL connections
netstat -an | grep :8002 | grep ESTABLISHED | wc -l

# Check system load
uptime
top

# Check disk space (low disk can cause issues)
df -h
```

## ⚠️ Critical: If Server Keeps Crashing

1. **Immediate**: Reduce DB pool to 2
2. **Immediate**: Use Nginx for SSL (if possible)
3. **Short-term**: Add swap space
4. **Long-term**: Upgrade server RAM to 2GB+

## 📝 Environment Variables to Set

Add to your `.env` or cPanel environment:

```bash
# Database pool (reduce for low memory)
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=2

# Python optimization
PYTHONHASHSEED=0
PYTHONUNBUFFERED=1
MALLOC_ARENA_MAX=2
```

## 🎯 Priority Order

1. **HIGHEST PRIORITY**: Use Nginx for SSL termination
2. **HIGH PRIORITY**: Reduce DB pool to 2
3. **MEDIUM PRIORITY**: Add swap space
4. **MEDIUM PRIORITY**: Set up systemd with memory limits
5. **LOW PRIORITY**: Monitor and auto-restart

---

**Most Effective Solution**: Use Nginx for SSL termination - this alone can reduce memory usage by 50-70%.

