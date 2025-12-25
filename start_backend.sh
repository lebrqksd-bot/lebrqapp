#!/bin/bash
# Start LeBRQ Backend Server
# This script starts the FastAPI backend on port 8000

echo "🚀 Starting LeBRQ Backend Server..."
echo ""
echo "Backend will run on: http://127.0.0.1:8000"
echo "API endpoints:https://taxtower.in:8002/api
"
echo "API docs: http://127.0.0.1:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Change to backend directory
cd backend

# Check if virtual environment exists
if [ -f "venv/bin/activate" ]; then
    echo "✓ Activating virtual environment..."
    source venv/bin/activate
else
    echo "⚠️  No virtual environment found. Using global Python..."
fi

# Start the server
echo "Starting uvicorn..."
python -m uvicorn app.core:app --reload --host 127.0.0.1 --port 8000

