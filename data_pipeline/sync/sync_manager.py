"""Sync Manager.

Orchestrates live updates across civic data sources, runs schema validation,
and invokes loaders to persist updates to PostgreSQL.
"""

import argparse
import sys
import time
from datetime import datetime, timezone

import psycopg2

from config import DATABASE_URL
from logging_config import setup_logging
from sync.connectors.datameet_connector import DataMeetConnector
from sync.connectors.ogd_connector import OGDConnector
from sync.connectors.judiciary_connector import JudiciaryConnector

logger = setup_logging("sync.manager")


class SyncManager:
    """Central orchestrator for syncing live data sources."""

    def __init__(self):
        self.datameet = DataMeetConnector()
        self.ogd = OGDConnector()
        self.judiciary = JudiciaryConnector()

    def sync_districts(self, version: str) -> bool:
        """Sync district boundary geometries from DataMeet."""
        logger.info("Initiating district sync...")
        try:
            self.datameet.fetch_latest()
            from etl.ingest_districts import ingest as ingest_districts
            from loaders.load_to_postgres import load_districts
            from config import OUTPUT_DIR

            out_file = ingest_districts(version)
            load_districts(out_file)
            logger.info("Districts sync completed successfully.")
            return True
        except Exception as e:
            logger.error("District sync failed: %s", e, exc_info=True)
            return False

    def sync_all(self, version: str) -> bool:
        """Run complete sync pipeline across all connectors."""
        logger.info("Running complete civic data sync (version=%s)", version)
        success = True
        success = success and self.sync_districts(version)
        return success


def main():
    parser = argparse.ArgumentParser(description="India Civic Transparency Live Sync Engine")
    parser.add_argument(
        "--source",
        choices=["all", "districts", "crime", "cases", "infra"],
        default="all",
        help="Data source to sync (default: all)",
    )
    parser.add_argument(
        "--version",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="Dataset version identifier",
    )
    args = parser.parse_args()

    manager = SyncManager()
    if args.source in ("all", "districts"):
        manager.sync_districts(args.version)


if __name__ == "__main__":
    main()
