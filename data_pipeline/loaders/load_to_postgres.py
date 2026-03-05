"""Unified database loader for all datasets.

Loads processed JSON/GeoJSON data into PostgreSQL with upsert semantics.
Records each ingestion in the dataset_ingestion_log table.
"""

import json
import os
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import DATABASE_URL
from logging_config import setup_logging

logger = setup_logging("etl.loader")


def _get_connection():
    return psycopg2.connect(DATABASE_URL)


def _log_ingestion(conn, dataset_name, dataset_source, dataset_version, record_count, status="completed", metadata=None):
    """Write a row to dataset_ingestion_log."""
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO dataset_ingestion_log
           (dataset_name, dataset_source, dataset_version, record_count, status, metadata)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (dataset_name, dataset_version) DO UPDATE SET
             ingested_at = NOW(),
             record_count = EXCLUDED.record_count,
             status = EXCLUDED.status,
             metadata = EXCLUDED.metadata""",
        (dataset_name, dataset_source, dataset_version, record_count, status,
         json.dumps(metadata) if metadata else None),
    )
    conn.commit()


def load_districts(geojson_path: str):
    """Load district GeoJSON into the districts table.

    Args:
        geojson_path: Path to normalized GeoJSON file.
    """
    logger.info("Loading districts from %s", geojson_path)

    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    conn = _get_connection()
    cur = conn.cursor()

    loaded = 0
    source = ""
    version = ""

    try:
        for feature in features:
            props = feature.get("properties", {})
            geom_json = json.dumps(feature.get("geometry"))

            source = props.get("dataset_source", "datameet")
            version = props.get("dataset_version", "")

            cur.execute(
                """INSERT INTO districts
                   (name, name_normalized, state, state_normalized, census_code,
                    geom, population, area_sq_km,
                    dataset_source, dataset_version, ingested_at)
                   VALUES (%s, %s, %s, %s, %s,
                           ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)),
                           %s, %s, %s, %s, %s)
                   ON CONFLICT (name_normalized, state_normalized) DO UPDATE SET
                     name = EXCLUDED.name,
                     state = EXCLUDED.state,
                     census_code = COALESCE(EXCLUDED.census_code, districts.census_code),
                     geom = EXCLUDED.geom,
                     population = COALESCE(EXCLUDED.population, districts.population),
                     area_sq_km = COALESCE(EXCLUDED.area_sq_km, districts.area_sq_km),
                     dataset_source = EXCLUDED.dataset_source,
                     dataset_version = EXCLUDED.dataset_version,
                     ingested_at = EXCLUDED.ingested_at""",
                (
                    props.get("name"),
                    props.get("name_normalized"),
                    props.get("state"),
                    props.get("state_normalized"),
                    props.get("census_code"),
                    geom_json,
                    props.get("population"),
                    props.get("area_sq_km"),
                    source,
                    version,
                    props.get("ingested_at", datetime.now(timezone.utc).isoformat()),
                ),
            )
            loaded += 1

        conn.commit()
        _log_ingestion(conn, "districts", source, version, loaded)
        logger.info("Loaded %d districts", loaded)
    except Exception as e:
        conn.rollback()
        _log_ingestion(conn, "districts", source, version, 0, "failed", {"error": str(e)})
        logger.error("Failed to load districts: %s", e)
        raise
    finally:
        cur.close()
        conn.close()


def load_cases(json_path: str):
    """Load Supreme Court cases from JSON.

    Args:
        json_path: Path to processed JSON file.
    """
    logger.info("Loading Supreme Court cases from %s", json_path)

    with open(json_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    conn = _get_connection()
    cur = conn.cursor()

    loaded = 0
    source = ""
    version = ""

    try:
        for case in cases:
            source = case.get("dataset_source", "s3://indian-supreme-court-judgments/")
            version = case.get("dataset_version", "")

            # Compute disposal duration
            disposal_days = None
            if case.get("date_filed") and case.get("decision_date"):
                try:
                    from datetime import date as date_type
                    d_filed = datetime.fromisoformat(case["date_filed"]).date() if isinstance(case["date_filed"], str) else case["date_filed"]
                    d_decision = datetime.fromisoformat(case["decision_date"]).date() if isinstance(case["decision_date"], str) else case["decision_date"]
                    disposal_days = (d_decision - d_filed).days
                    if disposal_days < 0:
                        disposal_days = None
                except (ValueError, TypeError):
                    disposal_days = None

            cur.execute(
                """INSERT INTO supreme_cases
                   (case_id, title, petitioner, respondent, judge,
                    date_filed, decision_date, citation, court, description,
                    disposal_duration_days,
                    dataset_source, dataset_version, ingested_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (case_id) DO UPDATE SET
                     title = EXCLUDED.title,
                     petitioner = EXCLUDED.petitioner,
                     respondent = EXCLUDED.respondent,
                     judge = EXCLUDED.judge,
                     date_filed = EXCLUDED.date_filed,
                     decision_date = EXCLUDED.decision_date,
                     citation = EXCLUDED.citation,
                     court = EXCLUDED.court,
                     description = EXCLUDED.description,
                     disposal_duration_days = EXCLUDED.disposal_duration_days,
                     dataset_source = EXCLUDED.dataset_source,
                     dataset_version = EXCLUDED.dataset_version,
                     ingested_at = EXCLUDED.ingested_at""",
                (
                    case.get("case_id"),
                    case.get("title"),
                    case.get("petitioner"),
                    case.get("respondent"),
                    case.get("judge"),
                    case.get("date_filed"),
                    case.get("decision_date"),
                    case.get("citation"),
                    case.get("court"),
                    case.get("description"),
                    disposal_days,
                    source,
                    version,
                    case.get("ingested_at", datetime.now(timezone.utc).isoformat()),
                ),
            )
            loaded += 1

        conn.commit()
        _log_ingestion(conn, "supreme_court", source, version, loaded)
        logger.info("Loaded %d cases", loaded)
    except Exception as e:
        conn.rollback()
        _log_ingestion(conn, "supreme_court", source, version, 0, "failed", {"error": str(e)})
        logger.error("Failed to load cases: %s", e)
        raise
    finally:
        cur.close()
        conn.close()


def load_crime(json_path: str):
    """Load crime statistics from JSON.

    Args:
        json_path: Path to processed JSON file.
    """
    logger.info("Loading crime stats from %s", json_path)

    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    conn = _get_connection()
    cur = conn.cursor()

    loaded = 0
    source = ""
    version = ""

    try:
        for rec in records:
            source = rec.get("dataset_source", "ncrb")
            version = rec.get("dataset_version", "")

            cur.execute(
                """INSERT INTO crime_stats
                   (district_id, year, category,
                    cases_registered, cases_charge_sheeted, cases_convicted,
                    dataset_source, dataset_version, ingested_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (district_id, year, category) DO UPDATE SET
                     cases_registered = EXCLUDED.cases_registered,
                     cases_charge_sheeted = EXCLUDED.cases_charge_sheeted,
                     cases_convicted = EXCLUDED.cases_convicted,
                     dataset_source = EXCLUDED.dataset_source,
                     dataset_version = EXCLUDED.dataset_version,
                     ingested_at = EXCLUDED.ingested_at""",
                (
                    rec.get("district_id"),
                    rec.get("year"),
                    rec.get("category"),
                    rec.get("cases_registered"),
                    rec.get("cases_charge_sheeted"),
                    rec.get("cases_convicted"),
                    source,
                    version,
                    rec.get("ingested_at", datetime.now(timezone.utc).isoformat()),
                ),
            )
            loaded += 1

        conn.commit()
        _log_ingestion(conn, "crime_stats", source, version, loaded)
        logger.info("Loaded %d crime records", loaded)
    except Exception as e:
        conn.rollback()
        _log_ingestion(conn, "crime_stats", source, version, 0, "failed", {"error": str(e)})
        logger.error("Failed to load crime stats: %s", e)
        raise
    finally:
        cur.close()
        conn.close()


def load_infrastructure(json_path: str):
    """Load infrastructure projects from JSON.

    Args:
        json_path: Path to processed JSON file.
    """
    logger.info("Loading infrastructure projects from %s", json_path)

    with open(json_path, "r", encoding="utf-8") as f:
        projects = json.load(f)

    conn = _get_connection()
    cur = conn.cursor()

    loaded = 0
    source = ""
    version = ""

    try:
        for proj in projects:
            source = proj.get("dataset_source", "pmgsy")
            version = proj.get("dataset_version", "")

            cur.execute(
                """INSERT INTO infrastructure_projects
                   (district_id, project_name, scheme, type, status,
                    sanctioned_cost, completion_pct, year,
                    dataset_source, dataset_version, ingested_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    proj.get("district_id"),
                    proj.get("project_name"),
                    proj.get("scheme"),
                    proj.get("type"),
                    proj.get("status"),
                    proj.get("sanctioned_cost"),
                    proj.get("completion_pct"),
                    proj.get("year"),
                    source,
                    version,
                    proj.get("ingested_at", datetime.now(timezone.utc).isoformat()),
                ),
            )
            loaded += 1

        conn.commit()
        _log_ingestion(conn, "infrastructure", source, version, loaded)
        logger.info("Loaded %d infrastructure projects", loaded)
    except Exception as e:
        conn.rollback()
        _log_ingestion(conn, "infrastructure", source, version, 0, "failed", {"error": str(e)})
        logger.error("Failed to load infrastructure: %s", e)
        raise
    finally:
        cur.close()
        conn.close()
