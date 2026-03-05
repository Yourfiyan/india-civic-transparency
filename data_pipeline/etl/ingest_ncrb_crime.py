"""Ingest NCRB (National Crime Records Bureau) crime CSV data.

Reads CSV files from raw/ncrb/, normalizes district and state names, matches
against known districts in the database, and outputs normalized JSON with
versioning metadata.

Usage:
    python -m etl.ingest_ncrb_crime [--version VERSION]
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import RAW_DIR, OUTPUT_DIR, DATABASE_URL
from logging_config import setup_logging
from etl.normalize_districts import normalize_name, normalize_state, match_district

logger = setup_logging("etl.ncrb_crime")

NCRB_RAW_DIR = RAW_DIR / "ncrb"
OUTPUT_FILE = OUTPUT_DIR / "crime_stats_normalized.json"
UNMATCHED_FILE = OUTPUT_DIR / "unmatched_districts.csv"
DEFAULT_SOURCE = "ncrb"


def _load_known_districts():
    """Load district list from database for matching."""
    import psycopg2

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, name_normalized, state_normalized FROM districts")
    districts = [
        {"id": row[0], "name_normalized": row[1], "state_normalized": row[2]}
        for row in cur.fetchall()
    ]
    cur.close()
    conn.close()
    logger.info("Loaded %d known districts from database", len(districts))
    return districts


def ingest(version: str) -> str:
    """Process NCRB CSV files and output normalized JSON.

    Args:
        version: Dataset version tag.

    Returns:
        Path to output file.
    """
    logger.info("Starting NCRB crime data ingestion (version=%s)", version)
    ingested_at = datetime.now(timezone.utc).isoformat()

    if not NCRB_RAW_DIR.exists():
        logger.error("NCRB raw directory not found: %s", NCRB_RAW_DIR)
        raise FileNotFoundError(f"Expected CSV files in {NCRB_RAW_DIR}")

    csv_files = sorted(NCRB_RAW_DIR.glob("*.csv"))
    if not csv_files:
        logger.error("No CSV files found in %s", NCRB_RAW_DIR)
        raise FileNotFoundError(f"No CSV files in {NCRB_RAW_DIR}")

    known_districts = _load_known_districts()

    records = []
    unmatched = []
    total_rows = 0
    matched_count = 0

    for csv_file in csv_files:
        logger.info("Processing NCRB CSV: %s", csv_file.name)

        with open(csv_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_rows += 1

                district_name = row.get("district") or row.get("district_name") or row.get("DISTRICT", "")
                state = row.get("state") or row.get("STATE", "")
                year = row.get("year") or row.get("YEAR")
                category = row.get("category") or row.get("crime_head") or row.get("CRIME_HEAD", "")

                district_id = match_district(district_name, state, known_districts)

                if district_id is None:
                    unmatched.append({
                        "district": district_name,
                        "state": state,
                        "source_file": csv_file.name,
                    })
                    continue

                matched_count += 1
                records.append({
                    "district_id": district_id,
                    "year": int(year) if year else None,
                    "category": category.strip().lower() if category else None,
                    "cases_registered": _safe_int(row.get("cases_registered") or row.get("registered")),
                    "cases_charge_sheeted": _safe_int(row.get("cases_charge_sheeted") or row.get("charge_sheeted")),
                    "cases_convicted": _safe_int(row.get("cases_convicted") or row.get("convicted")),
                    "dataset_source": DEFAULT_SOURCE,
                    "dataset_version": version,
                    "ingested_at": ingested_at,
                })

    logger.info("Matched %d / %d rows (%.1f%%)", matched_count, total_rows,
                (matched_count / total_rows * 100) if total_rows > 0 else 0)

    # Write unmatched districts for review
    if unmatched:
        OUTPUT_DIR.mkdir(exist_ok=True)
        with open(UNMATCHED_FILE, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["district", "state", "source_file"])
            writer.writeheader()
            # Deduplicate
            seen = set()
            for u in unmatched:
                key = (u["district"], u["state"])
                if key not in seen:
                    seen.add(key)
                    writer.writerow(u)
        logger.warning("Wrote %d unmatched districts to %s", len(seen), UNMATCHED_FILE)

    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    logger.info("Wrote %d crime records to %s", len(records), OUTPUT_FILE)
    return str(OUTPUT_FILE)


def _safe_int(val):
    """Convert value to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return None


def main():
    parser = argparse.ArgumentParser(description="Ingest NCRB crime CSV data")
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        help="Dataset version tag (default: today's date)")
    args = parser.parse_args()
    ingest(args.version)


if __name__ == "__main__":
    main()
