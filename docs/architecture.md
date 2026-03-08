# India Civic Transparency Platform — Architecture

## System Overview

Three independent layers connected through PostgreSQL/PostGIS:

1. **Data Pipeline** (Python) — batch ETL that ingests government datasets into PostgreSQL
2. **Backend** (Express/Node.js) — REST API serving data to the frontend
3. **Frontend** (React/Vite/Leaflet) — interactive map and analytics dashboard

## System Diagram

```mermaid
graph TD
    subgraph Data Sources
        S1[AWS S3 — Supreme Court Parquet]
        S2[DataMeet — District GeoJSON]
        S3[NCRB — Crime CSV]
        S4[PMGSY — Infrastructure JSON]
    end

    subgraph ETL Pipeline — Python
        E1[DuckDB — Parquet reader]
        E2[geopandas — GeoJSON processor]
        E3[District name normalizer]
        E4[Dataset versioning]
    end

    subgraph Database
        DB[(PostgreSQL + PostGIS)]
        T1[cases]
        T2[districts — geometry]
        T3[crime_registrations]
        T4[infrastructure_projects]
        T5[dataset_ingestion_log]
    end

    subgraph Backend — Express
        API[REST API]
        Cache[TopoJSON cache]
        Log1[pino JSON logger]
    end

    subgraph Frontend — React/Vite
        Map[Leaflet Canvas Map]
        Dash[Analytics Dashboard]
        Controls[Layer Controls]
    end

    S1 --> E1 --> DB
    S2 --> E2 --> E3 --> DB
    S3 --> E3
    S4 --> E3
    E4 --> T5

    DB --> API
    API --> Cache
    API --> Map
    API --> Dash
    Controls --> Map
```

## Data Flow

### Ingestion (ETL Pipeline)

1. `run_pipeline.py` orchestrates all loaders
2. Each loader reads from its source (S3, local files, URLs)
3. District names are normalized against a canonical list
4. Records are tagged with `dataset_source`, `dataset_version`, `ingested_at`
5. Data is inserted into PostgreSQL via parameterized queries
6. `dataset_ingestion_log` records what was loaded and when

### API Serving (Backend)

1. Express server starts, connects to PostgreSQL
2. District TopoJSON is pre-generated and cached on disk
3. API endpoints query PostgreSQL with optional `dataset_version` filter
4. Spatial queries use PostGIS functions (`ST_Centroid`, `ST_Within`)
5. Responses are JSON, logged with pino

### Rendering (Frontend)

1. App loads, fetches district TopoJSON from `/api/districts/topojson`
2. Leaflet renders 700+ district polygons on Canvas 2D
3. User toggles layers (crime, infrastructure) → new API calls
4. Crime data renders as proportional circles at district centroids
5. Infrastructure data renders as status-colored markers
6. Analytics dashboard fetches from `/api/analytics/*` endpoints

## Database Schema

### Core Tables

| Table | Key Columns | Spatial |
|-------|------------|---------|
| `districts` | id, name, state, geometry | PostGIS GEOMETRY |
| `cases` | id, title, date, bench, judgment_text | — |
| `crime_registrations` | district_id, year, crime_type, count | — |
| `infrastructure_projects` | district_id, project_name, status, cost | — |
| `dataset_ingestion_log` | dataset_name, version, row_count, ingested_at | — |

### Versioning

Every data table includes:
- `dataset_source` — origin identifier
- `dataset_version` — version tag (e.g., `2024-Q4`)
- `ingested_at` — UTC timestamp

This allows querying any historical snapshot: `GET /api/crime?dataset_version=2024-Q4`

## Key Technical Decisions

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| PostGIS | MongoDB geospatial, file-based GeoJSON | SQL joins between spatial and tabular data; district-level aggregation |
| DuckDB for ETL | pandas, Spark | Reads Parquet from S3 directly; handles GB-scale without cluster |
| Leaflet Canvas | Mapbox GL, SVG renderer | No API key; Canvas handles 700+ polygons at 60fps |
| TopoJSON cache | Real-time geometry queries | 200ms vs 4s load time; geometry rarely changes |
| Makefile | Docker Compose only, npm scripts | Single entry point for all operations; works across OS |
| pino logger | winston, console.log | Structured JSON; fast; easy to pipe to log aggregators |

## Deployment Options

### Docker Compose (Recommended)

```bash
docker-compose up -d    # PostgreSQL + PostGIS
make db-schema           # Apply schema
make seed                # Load demo data
make dev                 # Start frontend + backend
```

### Manual

1. Install PostgreSQL 14+ with PostGIS extension
2. Run `backend/.env` configuration
3. `make setup` installs all Node.js and Python dependencies
4. `make db-schema && make seed && make dev`
