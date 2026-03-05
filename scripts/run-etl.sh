#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(date +%Y%m%d)}"

echo "=== Running ETL Pipeline (version: $VERSION) ==="

cd "$ROOT/data_pipeline"
source .venv/bin/activate

python run_pipeline.py --steps all --version "$VERSION"

deactivate

echo ""
echo "=== Generating TopoJSON cache ==="
cd "$ROOT/backend"
node cache/generate-topojson.js

echo ""
echo "=== ETL complete ==="
