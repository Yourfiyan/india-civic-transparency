import pytest
from etl.normalize_districts import normalize_name, normalize_state, match_district

def test_normalize_name_basic():
    assert normalize_name("Mumbai") == "mumbai"
    assert normalize_name("  Delhi  ") == "delhi"
    assert normalize_name("Bangalore") == "bengaluru"
    assert normalize_name("Bombay") == "mumbai"
    assert normalize_name("Calcutta") == "kolkata"
    assert normalize_name("Madras") == "chennai"
    assert normalize_name("Poona") == "pune"

def test_normalize_name_strip_suffixes():
    assert normalize_name("Pune District") == "pune"
    assert normalize_name("Jaipur Dist.") == "jaipur"
    assert normalize_name("Lucknow Dt") == "lucknow"
    assert normalize_name("Agra Distt.") == "agra"

def test_normalize_name_diacritics():
    assert normalize_name("Bāṅgalūru") == "bangaluru"
    assert normalize_name("Dillī") == "dilli"

def test_normalize_state_basic():
    assert normalize_state("Orissa") == "odisha"
    assert normalize_state("Uttaranchal") == "uttarakhand"
    assert normalize_state("Pondicherry") == "puducherry"
    assert normalize_state("Maharashtra") == "maharashtra"
    assert normalize_state("") == ""

def test_match_district_exact():
    districts = [
        {"id": 1, "name_normalized": "mumbai", "state_normalized": "maharashtra"},
        {"id": 2, "name_normalized": "delhi", "state_normalized": "delhi"},
    ]
    assert match_district("Mumbai", "Maharashtra", districts) == 1
    assert match_district("Bombay", "Maharashtra", districts) == 1
    assert match_district("Delhi", "Delhi", districts) == 2

def test_match_district_fuzzy():
    districts = [
        {"id": 1, "name_normalized": "bengaluru urban", "state_normalized": "karnataka"},
        {"id": 2, "name_normalized": "bengaluru rural", "state_normalized": "karnataka"},
    ]
    # "bengaluru urban" should fuzzy match closely
    matched = match_district("Bengaluru Urban", "Karnataka", districts)
    assert matched == 1

def test_match_district_none():
    districts = [
        {"id": 1, "name_normalized": "mumbai", "state_normalized": "maharashtra"},
    ]
    assert match_district("NonExistentDistrict", "Nowhere", districts) is None
