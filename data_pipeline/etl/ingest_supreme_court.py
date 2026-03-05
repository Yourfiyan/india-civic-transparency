"""Ingest Supreme Court judgment metadata from AWS Open Data parquet files.

Downloads parquet metadata from s3://indian-supreme-court-judgments/ using
unsigned (no credentials) access, queries via DuckDB for memory efficiency,
and outputs JSON with versioning metadata.

Usage:
    python -m etl.ingest_supreme_court [--version VERSION]
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import RAW_DIR, OUTPUT_DIR
from logging_config import setup_logging

logger = setup_logging("etl.supreme_court")

S3_BUCKET = "indian-supreme-court-judgments"
DEFAULT_SOURCE = f"s3://{S3_BUCKET}/"
SC_RAW_DIR = RAW_DIR / "supreme_court"
OUTPUT_FILE = OUTPUT_DIR / "supreme_court_cases.json"


def download_parquet_files():
    """Download parquet files from the AWS Open Data S3 bucket."""
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config

    logger.info("Listing parquet files in %s", DEFAULT_SOURCE)
    s3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))

    SC_RAW_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = 0

    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".parquet"):
                continue

            local_path = SC_RAW_DIR / Path(key).name
            if local_path.exists():
                logger.debug("Already downloaded: %s", key)
                continue

            logger.info("Downloading s3://%s/%s", S3_BUCKET, key)
            s3.download_file(S3_BUCKET, key, str(local_path))
            downloaded += 1

    logger.info("Downloaded %d new parquet files to %s", downloaded, SC_RAW_DIR)


def process_with_duckdb(version: str) -> str:
    """Query parquet files via DuckDB and output JSON.

    Args:
        version: Dataset version tag.

    Returns:
        Path to output file.
    """
    import duckdb

    parquet_glob = str(SC_RAW_DIR / "*.parquet")
    logger.info("Querying parquet files: %s", parquet_glob)

    conn = duckdb.connect()
    ingested_at = datetime.now(timezone.utc).isoformat()

    try:
        result = conn.execute(f"""
            SELECT DISTINCT ON (case_id)
                case_id,
                title,
                petitioner,
                respondent,
                judge,
                decision_date,
                citation,
                court,
                description
            FROM read_parquet('{parquet_glob}')
            WHERE case_id IS NOT NULL
        """).fetchdf()
    except Exception as e:
        # DuckDB may not support DISTINCT ON; fall back to GROUP BY
        logger.warning("DISTINCT ON not supported, using GROUP BY: %s", e)
        result = conn.execute(f"""
            SELECT
                case_id,
                FIRST(title) AS title,
                FIRST(petitioner) AS petitioner,
                FIRST(respondent) AS respondent,
                FIRST(judge) AS judge,
                FIRST(decision_date) AS decision_date,
                FIRST(citation) AS citation,
                FIRST(court) AS court,
                FIRST(description) AS description
            FROM read_parquet('{parquet_glob}')
            WHERE case_id IS NOT NULL
            GROUP BY case_id
        """).fetchdf()

    logger.info("Processed %d unique cases via DuckDB", len(result))

    cases = []
    for _, row in result.iterrows():
        case = {
            "case_id": str(row.get("case_id", "")),
            "title": row.get("title"),
            "petitioner": row.get("petitioner"),
            "respondent": row.get("respondent"),
            "judge": row.get("judge"),
            "decision_date": str(row["decision_date"]) if row.get("decision_date") else None,
            "citation": row.get("citation"),
            "court": row.get("court"),
            "description": row.get("description"),
            "dataset_source": DEFAULT_SOURCE,
            "dataset_version": version,
            "ingested_at": ingested_at,
        }
        cases.append(case)

    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=2, default=str)

    logger.info("Wrote %d cases to %s", len(cases), OUTPUT_FILE)
    conn.close()
    return str(OUTPUT_FILE)


def ingest(version: str) -> str:
    """Full ingestion: download + process.

    Args:
        version: Dataset version tag.

    Returns:
        Path to output file.
    """
    logger.info("Starting Supreme Court ingestion (version=%s)", version)
    download_parquet_files()
    return process_with_duckdb(version)


def main():
    parser = argparse.ArgumentParser(description="Ingest Supreme Court parquet data")
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        help="Dataset version tag (default: today's date)")
    args = parser.parse_args()
    ingest(args.version)


if __name__ == "__main__":
    main()
