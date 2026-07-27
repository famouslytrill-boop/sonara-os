from app.services.civic_service import ingest_public_feed
from app.services.music_service import calculate_release_readiness
from app.services.tableops_service import calculate_food_cost

def test_civic_feed_endpoint_returns_list():
    assert isinstance(ingest_public_feed({"title": "Library update"}), list)

def test_music_readiness_score_returns_number():
    result = calculate_release_readiness({"title": "Song", "artist_name": "Artist", "genre": "pop", "bpm": 120, "key_signature": "C"})
    assert isinstance(result["score"], int)

def test_tableops_cost_calculator_returns_number():
    result = calculate_food_cost({"food_cost_estimate": 3, "sell_price_estimate": 10})
    assert isinstance(result["margin"], float)

