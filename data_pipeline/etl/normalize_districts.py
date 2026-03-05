"""District name normalization for cross-dataset matching.

Handles Indian district name variations: spelling differences, city renames (e.g.
Bangalore → Bengaluru), common suffixes, and fuzzy matching for edge cases.
"""

import re
import unicodedata
from difflib import SequenceMatcher

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from logging_config import setup_logging

logger = setup_logging("etl.normalize")

# Known Indian city/district renames and aliases
DISTRICT_ALIASES = {
    "bangalore": "bengaluru",
    "bangalore urban": "bengaluru urban",
    "bangalore rural": "bengaluru rural",
    "bombay": "mumbai",
    "calcutta": "kolkata",
    "madras": "chennai",
    "poona": "pune",
    "baroda": "vadodara",
    "trivandrum": "thiruvananthapuram",
    "cochin": "kochi",
    "calicut": "kozhikode",
    "cawnpore": "kanpur",
    "benares": "varanasi",
    "simla": "shimla",
    "ootacamund": "nilgiris",
    "vizag": "visakhapatnam",
    "alleppey": "alappuzha",
    "trichur": "thrissur",
    "palghat": "palakkad",
    "quilon": "kollam",
    "cannanore": "kannur",
    "tuticorin": "thoothukudi",
    "tinnevelly": "tirunelveli",
    "tanjore": "thanjavur",
    "kumbakonam": "thanjavur",
    "bellary": "ballari",
    "bijapur": "vijayapura",
    "gulbarga": "kalaburagi",
    "belgaum": "belagavi",
    "hubli": "hubballi",
    "raichur city": "raichur",
    "mysore": "mysuru",
    "mangalore": "mangaluru",
    "shimoga": "shivamogga",
    "tumkur": "tumakuru",
    "chikmagalur": "chikkamagaluru",
    "hospet": "hosapete",
    "gadag betigeri": "gadag",
    "pondicherry": "puducherry",
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
    "north arcot": "tiruvannamalai",
    "south arcot": "cuddalore",
    "gurgaon": "gurugram",
}

STATE_ALIASES = {
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
    "pondicherry": "puducherry",
}

# Suffixes to strip from district names
STRIP_SUFFIXES = re.compile(
    r"\s+(district|dt\.?|distt\.?|dist\.?)$", re.IGNORECASE
)


def _strip_diacritics(text: str) -> str:
    """Remove diacritics/accents from text."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_name(name: str) -> str:
    """Normalize a district or state name for cross-dataset matching.

    Applies: lowercase, strip whitespace, remove suffixes, apply alias mapping,
    strip diacritics.
    """
    if not name:
        return ""

    normalized = name.strip().lower()
    normalized = _strip_diacritics(normalized)
    normalized = STRIP_SUFFIXES.sub("", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    # Apply alias mapping
    normalized = DISTRICT_ALIASES.get(normalized, normalized)

    return normalized


def normalize_state(state: str) -> str:
    """Normalize a state name."""
    if not state:
        return ""
    normalized = state.strip().lower()
    normalized = _strip_diacritics(normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = STATE_ALIASES.get(normalized, normalized)
    return normalized


def match_district(name: str, state: str, known_districts: list, threshold: float = 0.85):
    """Match a district name against known districts using normalization and fuzzy matching.

    Args:
        name: District name to match.
        state: State name for context.
        known_districts: List of dicts with 'id', 'name_normalized', 'state_normalized'.
        threshold: Minimum similarity score for fuzzy match (0.0–1.0).

    Returns:
        Matched district_id (int) or None.
    """
    norm_name = normalize_name(name)
    norm_state = normalize_state(state)

    # Exact match (name + state)
    for d in known_districts:
        if d["name_normalized"] == norm_name and d["state_normalized"] == norm_state:
            return d["id"]

    # Exact name match (any state) — fallback for state name mismatches
    name_matches = [d for d in known_districts if d["name_normalized"] == norm_name]
    if len(name_matches) == 1:
        logger.debug(
            "Matched '%s' by name only (state mismatch: '%s' vs '%s')",
            name, norm_state, name_matches[0]["state_normalized"]
        )
        return name_matches[0]["id"]

    # Fuzzy match within the same state
    best_score = 0.0
    best_match = None
    state_districts = [d for d in known_districts if d["state_normalized"] == norm_state]

    for d in state_districts:
        score = SequenceMatcher(None, norm_name, d["name_normalized"]).ratio()
        if score > best_score:
            best_score = score
            best_match = d

    if best_match and best_score >= threshold:
        logger.info(
            "Fuzzy matched '%s' → '%s' (score=%.2f)",
            name, best_match["name_normalized"], best_score
        )
        return best_match["id"]

    logger.debug("No match for district '%s' (%s)", name, state)
    return None
