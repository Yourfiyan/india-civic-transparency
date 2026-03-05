#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== Seeding Database ==="

# Ensure DB is running
cd "$ROOT"
docker-compose up -d

echo "[1/3] Applying schema…"
docker-compose exec -T postgres psql -U civic -d civic_transparency < backend/db/schema.sql

echo "[2/3] Loading seed ingestion log…"
docker-compose exec -T postgres psql -U civic -d civic_transparency < backend/db/seed.sql

echo "[3/3] Loading seed data via Python loader…"
cd "$ROOT/data_pipeline"

if [ -d .venv ]; then
  source .venv/bin/activate
else
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --quiet -r requirements.txt
fi

# Copy seed data to expected output locations
mkdir -p output
cp "$ROOT/seed_data/districts_sample.geojson" output/districts_normalized.geojson
cp "$ROOT/seed_data/supreme_court_sample.json" output/supreme_court_cases.json
cp "$ROOT/seed_data/infrastructure_sample.json" output/infrastructure_projects.json

# Run the loader
python -c "
from loaders.load_to_postgres import load_districts, load_cases, load_infrastructure
load_districts('output/districts_normalized.geojson')
load_cases('output/supreme_court_cases.json')
load_infrastructure('output/infrastructure_projects.json')
print('Seed data loaded successfully.')
"

deactivate

echo ""
echo "=== Generating TopoJSON cache ==="
cd "$ROOT/backend"
node cache/generate-topojson.js

echo "=== Seeding complete ==="
