"""ETL Pipeline Orchestrator.

Runs data ingestion steps in dependency order with structured logging,
timing, and dataset versioning support.

Usage:
    python run_pipeline.py --steps all
    python run_pipeline.py --steps districts cases crime --version 2024-Q4
"""

import argparse
import sys
import time
import uuid
from datetime import datetime, timezone

sys.path.insert(0, __file__.rsplit("/", 1)[0] if "/" in __file__ else ".")
from logging_config import setup_logging

logger = setup_logging("etl.pipeline")

VALID_STEPS = {"districts", "cases", "crime", "load", "all"}


def run_step(name, func, *args, **kwargs):
    """Run a single pipeline step with timing."""
    logger.info("Starting step: %s", name)
    start = time.time()
    try:
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        logger.info("Step '%s' completed in %.1fs", name, elapsed)
        return result
    except Exception as e:
        elapsed = time.time() - start
        logger.error("Step '%s' failed after %.1fs: %s", name, elapsed, e, exc_info=True)
        raise


def main():
    parser = argparse.ArgumentParser(description="India Civic Transparency ETL Pipeline")
    parser.add_argument(
        "--steps", nargs="+", default=["all"],
        choices=list(VALID_STEPS),
        help="Pipeline steps to run (default: all)",
    )
    parser.add_argument(
        "--version", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="Dataset version tag (default: today's date)",
    )
    args = parser.parse_args()

    run_id = str(uuid.uuid4())[:8]
    steps = set(args.steps)
    run_all = "all" in steps

    logger.info("Pipeline started (run_id=%s, version=%s, steps=%s)", run_id, args.version, args.steps)
    pipeline_start = time.time()

    try:
        # Step 1: Ingest districts (must run first — other datasets depend on it)
        if run_all or "districts" in steps:
            from etl.ingest_districts import ingest as ingest_districts
            run_step("ingest_districts", ingest_districts, args.version)

        # Step 2: Ingest Supreme Court data
        if run_all or "cases" in steps:
            from etl.ingest_supreme_court import ingest as ingest_cases
            run_step("ingest_supreme_court", ingest_cases, args.version)

        # Step 3: Ingest NCRB crime data (depends on districts for matching)
        if run_all or "crime" in steps:
            from etl.ingest_ncrb_crime import ingest as ingest_crime
            run_step("ingest_ncrb_crime", ingest_crime, args.version)

        # Step 4: Load all processed data into PostgreSQL
        if run_all or "load" in steps:
            from loaders.load_to_postgres import load_districts, load_cases, load_crime
            from config import OUTPUT_DIR

            districts_file = OUTPUT_DIR / "districts_normalized.geojson"
            cases_file = OUTPUT_DIR / "supreme_court_cases.json"
            crime_file = OUTPUT_DIR / "crime_stats_normalized.json"

            if districts_file.exists():
                run_step("load_districts", load_districts, str(districts_file))
            else:
                logger.warning("Districts output not found, skipping load: %s", districts_file)

            if cases_file.exists():
                run_step("load_cases", load_cases, str(cases_file))
            else:
                logger.warning("Cases output not found, skipping load: %s", cases_file)

            if crime_file.exists():
                run_step("load_crime", load_crime, str(crime_file))
            else:
                logger.warning("Crime output not found, skipping load: %s", crime_file)

        total_elapsed = time.time() - pipeline_start
        logger.info("Pipeline completed in %.1fs (run_id=%s)", total_elapsed, run_id)

    except Exception as e:
        total_elapsed = time.time() - pipeline_start
        logger.error("Pipeline failed after %.1fs (run_id=%s): %s", total_elapsed, run_id, e)
        sys.exit(1)


if __name__ == "__main__":
    main()
