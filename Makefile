SHELL := /bin/bash

.PHONY: setup db-up db-schema seed etl etl-version cache dev logs-tail clean

# Full environment setup
setup:
	@bash scripts/setup.sh

# Start PostgreSQL via Docker
db-up:
	docker compose up -d

# Apply database schema
db-schema:
	@source backend/.env 2>/dev/null || true; \
	psql "$${DATABASE_URL}" -f backend/db/schema.sql

# Seed database with demo data
seed:
	@bash scripts/seed-db.sh

# Run full ETL pipeline (auto-versioned)
etl:
	@bash scripts/run-etl.sh

# Run ETL with explicit version
etl-version:
	@bash scripts/run-etl.sh --version $(VERSION)

# Regenerate TopoJSON cache
cache:
	cd backend && node cache/generate-topojson.js

# Start backend + frontend for development
dev:
	@bash scripts/start-dev.sh

# Tail log files
logs-tail:
	@tail -f logs/backend.log logs/etl-pipeline.log 2>/dev/null || echo "No log files found. Start the backend or run ETL first."

# Clean everything
clean:
	docker compose down -v 2>/dev/null || true
	rm -f backend/cache/static/*.topojson
	rm -f logs/*.log
	@echo "Cleaned database, caches, and logs."
