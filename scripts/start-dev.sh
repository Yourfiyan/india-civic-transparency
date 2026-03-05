#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== Starting Development Servers ==="

# Ensure DB is running
cd "$ROOT"
docker-compose up -d

cleanup() {
  echo ""
  echo "Shutting down…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend on :3000…"
cd "$ROOT/backend"
node server.js &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on :5173…"
cd "$ROOT/frontend"
npx vite --port 5173 &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:3000/api/health"
echo ""
echo "Press Ctrl+C to stop."

wait
