#!/bin/bash
# Memory monitoring script
# Usage: ./check_memory.sh

echo "=== Server Memory Status ==="
echo ""

# Total system memory
echo "System Memory:"
free -h
echo ""

# Python process memory
PID=$(pgrep -f "uvicorn app.core:app")
if [ -z "$PID" ]; then
    echo "⚠️  Server is not running"
else
    echo "Python Process Memory:"
    ps aux | grep "$PID" | grep -v grep | awk '{print "Memory: " $6/1024 " MB"}'
    echo ""
    
    # Memory percentage
    MEM_MB=$(ps -p $PID -o rss= | awk '{print $1/1024}')
    echo "Current Memory Usage: ${MEM_MB} MB"
    
    if (( $(echo "$MEM_MB > 400" | bc -l 2>/dev/null || echo "0") )); then
        echo "⚠️  WARNING: Memory usage is high (>400MB)"
    else
        echo "✅ Memory usage is normal"
    fi
fi

echo ""
echo "=== Database Connections ==="
# Check MySQL connections (adjust credentials)
mysql -u taxtower_admin -p'VNEBb?hG~L0X' -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null || echo "Could not check database connections"

echo ""
echo "=== Active Connections ==="
netstat -an | grep :8002 | grep ESTABLISHED | wc -l | awk '{print "Active connections: " $1}'

