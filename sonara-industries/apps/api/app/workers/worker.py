from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.formulas import exponential_smoothing
from app.services.civic_service import calculate_alert_severity
from app.services.ingestion_service import data_gov_metadata_placeholder, ingest_gtfs_realtime, parse_rss_placeholder
from app.services.media_service import extract_metadata
from app.services.music_service import calculate_release_readiness
from app.services.tableops_service import calculate_labor_projection


def execute_job(job: dict[str, Any]) -> dict[str, Any]:
    name = job.get("name")
    payload = job.get("payload", {})
    if name == "process_uploaded_media_metadata":
        return extract_metadata(payload)
    if name == "transcribe_audio_placeholder":
        return {"status": "transcription_placeholder", "asset_id": payload.get("asset_id")}
    if name == "import_rss_feed":
        return {"items": parse_rss_placeholder(payload.get("source_url", ""))}
    if name == "import_data_gov_metadata":
        return data_gov_metadata_placeholder(payload.get("query", ""))
    if name == "import_gtfs_realtime":
        return ingest_gtfs_realtime(payload.get("source_url", ""))
    if name == "recalculate_tableos_labor":
        return calculate_labor_projection(float(payload.get("labor_cost", 0)), float(payload.get("projected_sales", 0)))
    if name == "recalculate_soundos_readiness":
        return calculate_release_readiness(payload)
    if name == "send_alert_delivery_placeholder":
        return {"status": "approval_required_before_delivery", "severity": calculate_alert_severity(payload)}
    if name == "analytics_exponential_smoothing":
        return {"forecast": exponential_smoothing(float(payload.get("previous", 0)), float(payload.get("actual", 0)))}
    return {"status": "unknown_job", "name": name}


def run_worker() -> None:
    try:
        import redis
        from rq import Worker
        from rq import Queue
    except Exception:
        print("RQ dependencies are not installed; worker scaffold is available but not running.")
        return
    connection = redis.from_url(settings.redis_url)
    queues = [Queue(name, connection=connection) for name in ["media_queue", "transcription_queue", "feed_import_queue", "alert_delivery_queue", "billing_queue", "backup_queue", "analytics_queue"]]
    Worker(queues, connection=connection).work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
