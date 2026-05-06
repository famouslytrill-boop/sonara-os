from datetime import datetime, timezone

CONFIDENCE_LABELS = {"official_source", "verified_partner", "public_web_source", "community_submitted", "needs_review"}

def public_source_confidence_label(source: dict) -> str:
    label = source.get("confidence_label", "needs_review")
    return label if label in CONFIDENCE_LABELS else "needs_review"

def normalize_public_item(item: dict) -> dict:
    return {
        "title": item.get("title", "Untitled public item"),
        "body": item.get("summary") or item.get("body"),
        "source_url": item.get("link") or item.get("source_url"),
        "published_at": item.get("published_at") or datetime.now(timezone.utc).isoformat(),
        "confidence_label": public_source_confidence_label(item),
        "raw": item,
    }

def filter_by_city_state(items: list[dict], city: str | None, state: str | None) -> list[dict]:
    return [item for item in items if (not city or item.get("city") == city) and (not state or item.get("state") == state)]

def create_public_feed_source(payload: dict) -> dict:
    return {"source": payload, "status": "registered"}

def ingest_public_feed(payload: dict) -> list[dict]:
    return [normalize_public_item(payload)]

def create_organization_profile(payload: dict) -> dict:
    return {"profile": payload, "status": "draft"}

