# India Civic Transparency Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)

A full-stack civic data platform that visualizes Indian public datasets to help citizens understand government systems — Supreme Court judgments, crime statistics, district-level geographic data, and infrastructure development.

## Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        Leaflet[Leaflet Maps]
        Tailwind[Tailwind CSS]
        Dashboard[Analytics Dashboard]
    end

    subgraph Backend["Backend (Express API)"]
        API[REST API Routes]
        Pino[Pino Logger]
        Cache[TopoJSON Cache]
    end

    subgraph Database["PostgreSQL + PostGIS"]
        Tables[(Cases, Districts,\nCrime, Infrastructure)]
        Ingestion[(Dataset Ingestion Log)]
    end

    subgraph Pipeline["Data Pipeline (Python)"]
        DuckDB[DuckDB - Parquet Queries]
        GeoPandas[geopandas - GeoJSON]
        Normalize[District Name Normalization]
    end

    Frontend -->|HTTP Requests| Backend
    Backend -->|SQL + PostGIS| Database
    Pipeline -->|Seed & ETL| Database
    Cache -->|TopoJSON| Frontend
    Pipeline -->|Generate Cache| Cache
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Leaflet 1.9, Tailwind CSS 4.2 |
| Backend | Node.js, Express 4.21 |
| Database | PostgreSQL 16, PostGIS 3.4 |
| Data Pipeline | Python, DuckDB, geopandas, boto3 |
| Logging | pino (backend), Python logging (ETL) |
| Caching | Pre-generated TopoJSON files |

## Features

- **Interactive map of India** — Leaflet Canvas 2D renderer, zoom to districts, click for detail
- **Supreme Court cases** — paginated search and browse with case metadata
- **Crime registrations layer** — district-level NCRB data as proportional circle markers with "no data" indicators
- **Infrastructure layer** — status-colored markers (completed/in-progress/sanctioned) at district centroids
- **Layer controls** — toggle districts, crime, and infrastructure layers with opacity slider
- **Analytics dashboard** — judicial delay trends, crime-vs-justice comparison, composite district scores
- **Dataset versioning** — every record tracks source, version, and ingestion timestamp
- **Structured logging** — JSON logs for backend API and ETL pipeline

## Datasets

| Dataset | Source | Format |
|---------|--------|--------|
| Supreme Court Judgments | `s3://indian-supreme-court-judgments/` (AWS Open Data) | Parquet |
| District Boundaries | DataMeet India | GeoJSON |
| NCRB Crime Data | National Crime Records Bureau | CSV |
| Infrastructure (PMGSY) | Placeholder for road data | JSON |

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Python** 3.9+ ([download](https://www.python.org/))
- **PostgreSQL** 14+ with PostGIS, **or** Docker ([download](https://www.docker.com/))

## Quick Start

### 1. Clone and setup

```bash
git clone <repository-url>
cd india-civic-transparency

# Automated setup (Linux/macOS)
make setup

# Windows PowerShell
.\scripts\setup.ps1
```

### 2. Start the database

```bash
# Using Docker (recommended)
make db-up

# Or use an existing PostgreSQL instance — edit backend/.env
```

### 3. Create schema and seed data

```bash
make db-schema
make seed
```

### 4. Start development

```bash
make dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health check**: http://localhost:3000/api/health

## Running the Full ETL Pipeline

To ingest real datasets (requires internet access):

```bash
# Run full pipeline with a version tag
make etl-version VERSION=2024-Q4

# Or run with auto-generated version (today's date)
make etl
```

## API Endpoints

### Data Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/cases` | List Supreme Court cases (paginated, searchable) |
| GET | `/api/cases/:id` | Single case details |
| GET | `/api/districts` | List districts (no geometry) |
| GET | `/api/districts/topojson` | TopoJSON boundaries (cached) |
| GET | `/api/districts/:id` | District detail with geometry |
| GET | `/api/crime` | Crime statistics (filterable) |
| GET | `/api/crime/geo` | Crime counts with district centroids |
| GET | `/api/crime/summary` | Aggregated crime by state/year |
| GET | `/api/infrastructure` | Infrastructure projects |
| GET | `/api/infrastructure/geo` | Projects with district centroids |
| GET | `/api/datasets` | Ingested dataset versions |
| GET | `/api/datasets/:name` | Version history for a dataset |

### Analytics Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/judicial-delay` | Average case disposal time by year |
| GET | `/api/analytics/crime-vs-justice` | Crime rate vs conviction rate by district |
| GET | `/api/analytics/district-score` | Composite transparency/development score |

All data and analytics endpoints accept an optional `?dataset_version=` parameter for reproducible queries.

## Logging

Structured logs are written to the `/logs` directory:

- `logs/backend.log` — JSON-formatted backend API logs (pino)
- `logs/etl-pipeline.log` — ETL pipeline execution logs (Python logging)

```bash
# Tail logs in real-time
make logs-tail
```

## Dataset Versioning

Every ingested record carries:

- `dataset_source` — origin identifier (e.g., `datameet`, `ncrb`, `s3://...`)
- `dataset_version` — version tag (e.g., `2024-Q4`, `seed-v1`)
- `ingested_at` — UTC timestamp of ingestion

The `dataset_ingestion_log` table provides an audit trail of all ingestions.

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make setup` | Install all dependencies |
| `make db-up` | Start PostgreSQL via Docker |
| `make db-schema` | Apply database schema |
| `make seed` | Load seed data for demo |
| `make etl` | Run full ETL pipeline |
| `make etl-version VERSION=X` | Run ETL with explicit version |
| `make cache` | Regenerate TopoJSON cache |
| `make dev` | Start backend + frontend |
| `make logs-tail` | Tail log files |
| `make clean` | Stop DB, remove caches and logs |

## Project Structure

```
india-civic-transparency/
├── backend/          Express API server
├── data_pipeline/    Python ETL scripts
├── frontend/         React + Leaflet + Tailwind CSS application
├── logs/             Structured log output
├── scripts/          Developer automation
└── seed_data/        Demo datasets for instant setup
```

## Case Study

### Problem

Indian civic data — court judgments, crime statistics, infrastructure projects — is scattered across government portals in inconsistent formats (CSV, Parquet, GeoJSON). Citizens have no way to cross-reference this data at the district level, making it impossible to answer questions like "which districts have high crime but low conviction rates?" or "where has road construction stalled?"

### Solution

A full-stack platform that ingests, normalizes, and visualizes civic datasets on an interactive map. District-level aggregation enables cross-dataset comparison. All data is versioned — every record tracks its source, version tag, and ingestion timestamp — so analyses are reproducible.

### Architecture Decisions

- **Leaflet over Mapbox/Google Maps**: Open-source, no API key required, Canvas 2D renderer handles 700+ district polygons without performance issues
- **PostGIS over plain PostgreSQL**: Spatial queries (point-in-polygon, centroid calculation) are essential for mapping infrastructure and crime data to districts
- **DuckDB in the ETL pipeline**: Reads Parquet files from S3 directly without downloading, handles gigabyte-scale datasets with zero configuration
- **Separate frontend/backend/pipeline**: Each layer can be developed and deployed independently. The Python pipeline runs as a batch job, not as part of the web server.
- **Dataset versioning**: Government data changes without notice. Versioning lets users compare results across different data releases.

### Security Considerations

- Backend environment variables (DB credentials, API keys) stored in `.env`, excluded from git
- API endpoints are read-only — no user-submitted data enters the database
- SQL queries use parameterized queries throughout the Express backend
- Data pipeline validates schema before insertion to prevent corrupted imports
- Structured JSON logging (pino) provides an audit trail without exposing sensitive data

### Lessons Learned

- **District name normalization is the hardest part**: Government datasets use different spellings, transliterations, and administrative divisions. The normalization logic in the ETL pipeline handles more edge cases than the entire frontend.
- **TopoJSON caching is essential**: Generating district boundaries on every request was too slow. Pre-generating and caching TopoJSON cut load time from 4s to 200ms.
- **Seed data enables contribution**: Including demo data means contributors can run the full stack without AWS credentials or a government data account.
- **The Makefile is the documentation**: `make setup`, `make dev`, `make etl` — contributors don't need to read setup docs if the Makefile works.

See [docs/architecture.md](docs/architecture.md) for a detailed system architecture.

