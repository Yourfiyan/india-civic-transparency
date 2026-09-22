"""Open Government Data (data.gov.in) API Connector.

Fetches structured civic datasets (NCRB Crime in India & PMGSY Infrastructure)
from India's Open Government Data platform.
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import RAW_DIR
from logging_config import setup_logging

logger = setup_logging("sync.ogd")

# OGD India API endpoint constants
OGD_BASE_URL = "https://api.data.gov.in/resource"


class OGDConnector:
    """Sync connector for Open Government Data (data.gov.in) resources."""

    def __init__(self, api_key: Optional[str] = None, raw_dir: Path = RAW_DIR):
        self.api_key = api_key or os.environ.get("DATA_GOV_IN_API_KEY", "")
        self.raw_dir = raw_dir
        self.ncrb_dir = self.raw_dir / "ncrb"
        self.pmgsy_dir = self.raw_dir / "pmgsy"

    def fetch_resource(
        self, resource_id: str, limit: int = 1000, offset: int = 0
    ) -> Dict[str, Any]:
        """Fetch records from a data.gov.in resource endpoint.

        Args:
            resource_id: The OGD resource identifier.
            limit: Page size.
            offset: Page offset.

        Returns:
            JSON response dictionary.
        """
        params = {
            "api-key": self.api_key or "test-key",
            "format": "json",
            "limit": limit,
            "offset": offset,
        }
        url = f"{OGD_BASE_URL}/{resource_id}?{urllib.parse.urlencode(params)}"
        logger.info("Requesting OGD resource %s (offset=%d, limit=%d)", resource_id, offset, limit)

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "India-Civic-Transparency-Sync/1.0", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning("OGD API request failed (%s): fallback to local repository cache", e)
            return {"records": [], "count": 0, "status": "fallback"}
