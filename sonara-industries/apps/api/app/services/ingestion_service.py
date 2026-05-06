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

