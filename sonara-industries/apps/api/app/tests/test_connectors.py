from app.services.ingestion_service import data_gov_metadata_placeholder, parse_local_csv_upload, parse_local_json_upload


def test_connector_csv_and_json_parsing():
    csv_items = parse_local_csv_upload("title,category\nLibrary update,community\n")
    json_items = parse_local_json_upload('{"title":"Transit notice"}')
    assert csv_items[0]["raw"]["title"] == "Library update"
    assert json_items[0]["raw"]["title"] == "Transit notice"


def test_data_gov_connector_is_metadata_only():
    result = data_gov_metadata_placeholder("parks")
    assert result["connector"] == "data_gov_ckan_metadata"
    assert result["status"] == "connector_ready"
