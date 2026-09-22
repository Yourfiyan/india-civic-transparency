"""DataMeet Maps Connector.

Syncs official administrative district boundaries from DataMeet.
"""

import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from config import RAW_DIR
from logging_config import setup_logging

logger = setup_logging("sync.datameet")

DATAMEET_RAW_URL = (
    "https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson"
)


class DataMeetConnector:
    """Sync connector for DataMeet geospatial boundary datasets."""

    def __init__(self, raw_dir: Path = RAW_DIR):
        self.raw_dir = raw_dir
        self.raw_file = self.raw_dir / "india-districts.geojson"

    def fetch_latest(self) -> Path:
        """Download latest district GeoJSON from DataMeet mirror."""
        logger.info("Fetching latest DataMeet district boundaries from %s", DATAMEET_RAW_URL)
        self.raw_dir.mkdir(parents=True, exist_ok=True)

        req = urllib.request.Request(
            DATAMEET_RAW_URL,
            headers={"User-Agent": "India-Civic-Transparency-Sync/1.0"},
        )
        with urllib.request.urlopen(req) as resp, open(self.raw_file, "wb") as f:
            f.write(resp.read())

        file_size_mb = self.raw_file.stat().st_size / (1024 * 1024)
        logger.info("Successfully downloaded DataMeet dataset (%.2f MB)", file_size_mb)
        return self.raw_file
