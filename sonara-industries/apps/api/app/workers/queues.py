from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.core.config import settings

QUEUE_NAMES = [
    "media_queue",
    "transcription_queue",
    "feed_import_queue",
    "alert_delivery_queue",
    "billing_queue",
    "backup_queue",
    "analytics_queue",
]


@dataclass(frozen=True)
class QueueJob:
    queue: str
    name: str
    payload: dict[str, Any]
    idempotency_key: str
    max_retries: int = 3


def enqueue_job(job: QueueJob) -> dict[str, Any]:
    if job.queue not in QUEUE_NAMES:
        return {"ok": False, "error": "unknown_queue"}
    try:
        import redis
        from rq import Queue, Retry
    except Exception:
        return {"ok": False, "error": "rq_not_installed", "job": job.__dict__}
    connection = redis.from_url(settings.redis_url)
    queue = Queue(job.queue, connection=connection)
    queued = queue.enqueue("app.workers.worker.execute_job", job.__dict__, job_id=job.idempotency_key, retry=Retry(max=job.max_retries))
    return {"ok": True, "job_id": queued.id, "queue": job.queue}


def dead_letter(job: QueueJob, reason: str) -> dict[str, Any]:
    return {"status": "dead_letter", "job": job.__dict__, "reason": reason}


def execute_with_retry(job: QueueJob, handler: Callable[[dict[str, Any]], dict[str, Any]]) -> dict[str, Any]:
    try:
        return handler(job.payload)
    except Exception as exc:
        return dead_letter(job, str(exc))
