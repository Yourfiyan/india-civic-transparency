#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== India Civic Transparency — Setup ==="

# ---- prerequisites ----
for cmd in node npm python3 docker docker-compose; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd is not installed. Please install it first."
    exit 1
  fi
done

echo "[1/5] Installing backend dependencies…"
cd "$ROOT/backend"
npm install

echo "[2/5] Setting up Python virtual environment…"
cd "$ROOT/data_pipeline"
python3 -m venv .venv
source .venv/bin/activate
pip install --quiet -r requirements.txt
deactivate

echo "[3/5] Copying .env files…"
cd "$ROOT/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created backend/.env from .env.example"
else
  echo "  backend/.env already exists, skipping"
fi

echo "[4/5] Starting PostgreSQL + PostGIS…"
cd "$ROOT"
docker-compose up -d

echo "[5/5] Waiting for database to be ready…"
until docker-compose exec -T postgres pg_isready -U civic &>/dev/null; do
  sleep 1
done

echo "[6/5] Applying database schema…"
docker-compose exec -T postgres psql -U civic -d civic_transparency < backend/db/schema.sql

echo "[7/5] Installing frontend dependencies…"
cd "$ROOT/frontend"
npm install

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "  make seed     # load seed data"
echo "  make dev      # start backend + frontend"
