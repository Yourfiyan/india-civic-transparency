import pytest
from pydantic import ValidationError
from etl.schemas import (
    DistrictFeatureProperties,
    SupremeCaseRecord,
    CrimeRecord,
    InfrastructureRecord,
)

def test_district_schema_valid():
    d = DistrictFeatureProperties(
        name="Mumbai",
        name_normalized="mumbai",
        state="Maharashtra",
        state_normalized="maharashtra",
        population=12442373,
        area_sq_km=603.0,
    )
    assert d.name == "Mumbai"
    assert d.dataset_source == "datameet"

def test_district_schema_invalid():
    with pytest.raises(ValidationError):
        DistrictFeatureProperties(
            name="",  # min_length violation
            name_normalized="mumbai",
            state="Maharashtra",
            state_normalized="maharashtra",
        )

def test_supreme_case_schema():
    case = SupremeCaseRecord(
        case_id="SC-2020-001",
        title="Test v. State",
        bench_strength=3,
        disposal_duration_days=450,
    )
    assert case.case_id == "SC-2020-001"
    assert case.court == "Supreme Court of India"

def test_crime_record_schema():
    rec = CrimeRecord(
        district_id=1,
        year=2022,
        category="theft",
        cases_registered=100,
        cases_convicted=40,
    )
    assert rec.cases_registered == 100

def test_crime_record_invalid_year():
    with pytest.raises(ValidationError):
        CrimeRecord(
            district_id=1,
            year=1800,  # ge=1950 violation
            category="theft",
        )

def test_infrastructure_schema():
    infra = InfrastructureRecord(
        district_id=1,
        project_name="Rural Road Connection",
        status="completed",
        completion_pct=100.0,
    )
    assert infra.status == "completed"
