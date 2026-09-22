import pytest
from unittest.mock import MagicMock, patch
from sync.connectors.datameet_connector import DataMeetConnector
from sync.connectors.ogd_connector import OGDConnector
from sync.connectors.judiciary_connector import JudiciaryConnector
from sync.sync_manager import SyncManager


def test_datameet_connector_init(tmp_path):
    connector = DataMeetConnector(raw_dir=tmp_path)
    assert connector.raw_file == tmp_path / "india-districts.geojson"


def test_ogd_connector_fallback(tmp_path):
    connector = OGDConnector(api_key="test", raw_dir=tmp_path)
    res = connector.fetch_resource("invalid-resource-id-1234")
    assert res.get("status") == "fallback"
    assert res.get("records") == []


def test_judiciary_connector_init(tmp_path):
    connector = JudiciaryConnector(raw_dir=tmp_path)
    records = connector.fetch_recent_judgments(2024)
    assert isinstance(records, list)


def test_sync_manager_init():
    manager = SyncManager()
    assert manager.datameet is not None
    assert manager.ogd is not None
    assert manager.judiciary is not None
