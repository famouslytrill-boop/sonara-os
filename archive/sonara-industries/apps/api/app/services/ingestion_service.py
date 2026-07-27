from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone


def parse_rss_placeholder(source_url: str) -> list[dict]:
    try:
        import feedparser
        feed = feedparser.parse(source_url)
        return [{"title": entry.get("title"), "summary": entry.get("summary"), "link": entry.get("link"), "raw": dict(entry)} for entry in feed.entries]
    except Exception:
        return [{"title": "RSS parser placeholder", "summary": "Install feedparser and provide a valid source URL.", "source_url": source_url}]

def ingest_gtfs_static(source_url: str) -> dict:
    return {"source_url": source_url, "status": "placeholder", "type": "gtfs_static"}

def ingest_gtfs_realtime(source_url: str) -> dict:
    return {"source_url": source_url, "status": "placeholder", "type": "gtfs_realtime"}

def normalize_transit_alert(payload: dict) -> dict:
    return {"title": payload.get("title", "Transit alert"), "raw": payload}


def data_gov_metadata_placeholder(query: str) -> dict:
    return {
        "status": "connector_ready",
        "connector": "data_gov_ckan_metadata",
        "query": query,
        "note": "Uses public CKAN metadata APIs when DATA_GOV_API_KEY or public rate limits are configured.",
    }


def nws_weather_placeholder(zone_or_point: str) -> dict:
    return {
        "status": "connector_ready",
        "connector": "national_weather_service",
        "source": zone_or_point,
        "note": "Requires a descriptive NWS_USER_AGENT and human review before public broadcast.",
    }


def parse_local_csv_upload(content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content))
    return [{"raw": row, "imported_at": datetime.now(timezone.utc).isoformat(), "confidence_label": "needs_review"} for row in reader]


def parse_local_json_upload(content: str) -> list[dict]:
    data = json.loads(content)
    items = data if isinstance(data, list) else [data]
    return [{"raw": item, "imported_at": datetime.now(timezone.utc).isoformat(), "confidence_label": "needs_review"} for item in items]
