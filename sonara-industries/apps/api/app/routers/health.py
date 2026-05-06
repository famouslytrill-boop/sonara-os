from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok", "service": "sonara-industries-api"}

@router.get("/health/deep")
def deep_health():
    return {"status": "ok", "database": "not_checked", "redis": "not_checked"}

@router.get("/readiness")
def readiness():
    return {"status": "ready", "checks": {"database": "configured_by_env", "redis": "configured_by_env"}}

@router.get("/version")
def version():
    return {"name": "SONARA Industries API", "version": "0.3.0"}

@router.get("/worker/health")
def worker_health():
    return {"status": "configured", "queues": ["media_queue", "transcription_queue", "feed_import_queue", "alert_delivery_queue", "billing_queue", "backup_queue", "analytics_queue"]}
