"""Structured logging setup for the ETL pipeline."""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(name: str = "etl") -> logging.Logger:
    """Configure and return a logger with file and console handlers.

    Args:
        name: Logger name (appears in log records).

    Returns:
        Configured logger instance.
    """
    log_dir = Path(os.environ.get("LOG_DIR", Path(__file__).resolve().parent.parent / "logs"))
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "etl-pipeline.log"

    level_name = os.environ.get("ETL_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid adding duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s | %(name)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # Rotating file handler: 10 MB per file, keep 3 backups
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger
