"""Ingest DataMeet India district boundary GeoJSON.

Reads GeoJSON from raw/, normalizes district/state names, simplifies geometries,
and outputs normalized GeoJSON with versioning metadata.

Usage:
    python -m etl.ingest_districts [--version VERSION]
"""

import argparse
import json
from datetime import datetime, timezone

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import RAW_DIR, OUTPUT_DIR
from logging_config import setup_logging
from etl.normalize_districts import normalize_name, normalize_state

logger = setup_logging("etl.districts")

DEFAULT_SOURCE = "datameet"
INPUT_FILE = RAW_DIR / "india-districts.geojson"
OUTPUT_FILE = OUTPUT_DIR / "districts_normalized.geojson"


def ingest(version: str) -> str:
    """Process district GeoJSON and output normalized version.

    Args:
        version: Dataset version tag.

    Returns:
        Path to output file.
    """
    logger.info("Starting district GeoJSON ingestion (version=%s)", version)
    ingested_at = datetime.now(timezone.utc).isoformat()

    if not INPUT_FILE.exists():
        logger.error("Input file not found: %s", INPUT_FILE)
        logger.info(
            "Download DataMeet district boundaries to %s before running this step.", INPUT_FILE
        )
        raise FileNotFoundError(f"Expected GeoJSON at {INPUT_FILE}")

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    logger.info("Parsed GeoJSON: %d features", len(features))

    normalized_features = []
    for feature in features:
        props = feature.get("properties", {})
        name = props.get("NAME_3") or props.get("district") or props.get("DISTRICT") or props.get("name", "")
        state = props.get("NAME_1") or props.get("state") or props.get("STATE") or props.get("ST_NM", "")

        if not name or not state:
            logger.warning("Skipping feature with missing name/state: %s", props)
            continue

        name_norm = normalize_name(name)
        state_norm = normalize_state(state)

        new_props = {
            "name": name.strip(),
            "name_normalized": name_norm,
            "state": state.strip(),
            "state_normalized": state_norm,
            "census_code": props.get("censuscode") or props.get("C_CODE11") or props.get("census_code"),
            "population": props.get("population") or props.get("TOT_P"),
            "area_sq_km": props.get("area_sq_km") or props.get("AREA"),
            "dataset_source": DEFAULT_SOURCE,
            "dataset_version": version,
            "ingested_at": ingested_at,
        }

        normalized_features.append({
            "type": "Feature",
            "properties": new_props,
            "geometry": feature.get("geometry"),
        })

    output = {
        "type": "FeatureCollection",
        "features": normalized_features,
    }

    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f)

    logger.info("Wrote %d normalized districts to %s", len(normalized_features), OUTPUT_FILE)
    return str(OUTPUT_FILE)


def main():
    parser = argparse.ArgumentParser(description="Ingest DataMeet district boundaries")
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        help="Dataset version tag (default: today's date)")
    args = parser.parse_args()
    ingest(args.version)


if __name__ == "__main__":
    main()
