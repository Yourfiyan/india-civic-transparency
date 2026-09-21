SHELL := /bin/bash

.PHONY: setup db-up db-schema seed etl etl-version cache dev test test-backend test-frontend test-pipeline benchmark logs-tail clean

# Full environment setup
setup:
	@bash scripts/setup.sh

# Start PostgreSQL via Docker
db-up:
	docker compose up -d postgres

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

# Run all test suites
test: test-backend test-frontend test-pipeline

# Run backend integration tests
test-backend:
	cd backend && npm test

# Run frontend unit and component tests
test-frontend:
	cd frontend && npm test

# Run data pipeline unit and contract tests
test-pipeline:
	cd data_pipeline && .venv/bin/pytest tests/

# Run performance benchmarks
benchmark:
	node scripts/benchmark.js

# Tail log files
logs-tail:
	@tail -f logs/backend.log logs/etl-pipeline.log 2>/dev/null || echo "No log files found. Start the backend or run ETL first."

# Clean everything
clean:
	docker compose down -v 2>/dev/null || true
	rm -f backend/cache/static/*.topojson
	rm -f logs/*.log
	@echo "Cleaned database, caches, and logs."
