#!/usr/bin/env bash
# ============================================================
# India Civic Transparency — Colab Bootstrap Script
# Run this ONCE per new Colab session to restore everything.
#
# Usage:  bash bootstrap.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  India Civic Transparency — Colab Bootstrap          ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. PostgreSQL + PostGIS ──────────────────────────────────
echo ""
echo "[1/7] Installing PostgreSQL 14 + PostGIS 3..."
if pg_isready -q 2>/dev/null; then
  echo "  → PostgreSQL already running, skipping install."
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-14 postgresql-14-postgis-3 > /dev/null 2>&1
  sudo pg_ctlcluster 14 main start
  echo "  → PostgreSQL 14 started."
fi

# ── 2. Create DB user + database ─────────────────────────────
echo ""
echo "[2/7] Creating database user and database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='civic'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER civic WITH PASSWORD 'civic' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='civic_transparency'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE civic_transparency OWNER civic;"
echo "  → User 'civic' and DB 'civic_transparency' ready."

# ── 3. Apply schema ──────────────────────────────────────────
echo ""
echo "[3/7] Applying database schema..."
PGUSER=civic PGPASSWORD=civic PGHOST=localhost PGDATABASE=civic_transparency \
  psql -f "$ROOT/backend/db/schema.sql" > /dev/null 2>&1
echo "  → Schema applied (PostGIS, districts, cases, crime, infra tables)."

# ── 4. Seed all data ─────────────────────────────────────────
echo ""
echo "[4/7] Loading seed data..."

# Ingestion log
PGUSER=civic PGPASSWORD=civic PGHOST=localhost PGDATABASE=civic_transparency \
  psql -f "$ROOT/backend/db/seed.sql" > /dev/null 2>&1

# Python loaders for all four datasets
cd "$ROOT/data_pipeline"
PGUSER=civic PGPASSWORD=civic PGHOST=localhost PGDATABASE=civic_transparency \
  python3 -c "
import sys, csv, json
sys.path.insert(0, '.')
from loaders.load_to_postgres import load_districts, load_cases, load_crime, load_infrastructure

# Districts
load_districts('$ROOT/seed_data/districts_sample.geojson')

# Supreme Court cases
load_cases('$ROOT/seed_data/supreme_court_sample.json')

# Crime stats (CSV → JSON temp conversion)
crimes = []
with open('$ROOT/seed_data/ncrb_crime_sample.csv') as f:
    reader = csv.DictReader(f)
    # We need district_id, not district_name — resolve via DB
    import psycopg2
    conn = psycopg2.connect(host='localhost', user='civic', password='civic', dbname='civic_transparency')
    cur = conn.cursor()
    cur.execute('SELECT name_normalized, id FROM districts')
    dist_map = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    for row in reader:
        name_norm = row['district_name'].lower().strip()
        did = dist_map.get(name_norm)
        if did:
            crimes.append({
                'district_id': did,
                'year': int(row['year']),
                'category': row['category'],
                'cases_registered': int(row['cases_registered']),
                'cases_charge_sheeted': int(row['cases_charge_sheeted']),
                'cases_convicted': int(row['cases_convicted']),
                'dataset_source': row.get('dataset_source', 'ncrb'),
                'dataset_version': row.get('dataset_version', 'seed-v1'),
                'ingested_at': row.get('ingested_at', '2026-01-01T00:00:00Z'),
            })
import tempfile, os
tmp = os.path.join(tempfile.gettempdir(), 'crime_seed.json')
with open(tmp, 'w') as f:
    json.dump(crimes, f)
load_crime(tmp)

# Infrastructure
load_infrastructure('$ROOT/seed_data/infrastructure_sample.json')
print('All seed data loaded.')
"
cd "$ROOT"
echo "  → Districts, cases, crime stats, and infra projects loaded."

# ── 5. Generate TopoJSON cache ────────────────────────────────
echo ""
echo "[5/7] Generating TopoJSON cache..."
cd "$ROOT/backend"
PGUSER=civic PGPASSWORD=civic PGHOST=localhost PGDATABASE=civic_transparency \
  node cache/generate-topojson.js 2>/dev/null
cd "$ROOT"
echo "  → TopoJSON cache generated."

# ── 6. Fix esbuild binary (Google Drive FUSE can't exec) ─────
echo ""
echo "[6/7] Fixing esbuild binary..."
ESBUILD_SRC="$ROOT/frontend/node_modules/@esbuild/linux-x64/bin/esbuild"
if [ -f "$ESBUILD_SRC" ]; then
  cp "$ESBUILD_SRC" /tmp/esbuild-bin
  chmod +x /tmp/esbuild-bin
  echo "  → esbuild copied to /tmp/esbuild-bin"
else
  echo "  → WARNING: esbuild source not found. Run 'cd frontend && npm install' first."
fi

# ── 7. Start servers ──────────────────────────────────────────
echo ""
echo "[7/7] Starting backend and frontend..."

# Backend
cd "$ROOT/backend"
PGUSER=civic PGPASSWORD=civic PGDATABASE=civic_transparency PGHOST=localhost PGPORT=5432 \
  nohup node server.js > /dev/null 2>&1 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
ESBUILD_BINARY_PATH=/tmp/esbuild-bin \
  nohup npx vite --port 5173 --host 0.0.0.0 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Wait for backend health
sleep 3
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "  → Backend running on :3000 (PID $BACKEND_PID)"
else
  echo "  → WARNING: Backend may still be starting..."
fi
echo "  → Frontend running on :5173 (PID $FRONTEND_PID)"

cd "$ROOT"
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ Bootstrap complete!                               ║"
echo "║                                                      ║"
echo "║  Backend API:  http://localhost:3000                  ║"
echo "║  Frontend:     http://localhost:5173                  ║"
echo "║  Health check: http://localhost:3000/api/health       ║"
echo "╚══════════════════════════════════════════════════════╝"
