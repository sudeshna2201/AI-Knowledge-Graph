#!/usr/bin/env bash
set -e

echo "Starting Flask API on port 8000..."
python api.py &
API_PID=$!

echo "Starting Vite frontend on port 5000..."
cd frontend && npm run dev

wait $API_PID
