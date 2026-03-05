"""Shared configuration for the data pipeline."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw"
OUTPUT_DIR = BASE_DIR / "output"
LOG_DIR = Path(os.environ.get("LOG_DIR", BASE_DIR.parent / "logs"))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://civic:civic@localhost:5432/civic_transparency",
)

# Ensure directories exist
RAW_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)
