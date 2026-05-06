from fastapi import APIRouter
from app.services.ingestion_service import parse_rss_placeholder, ingest_gtfs_static, ingest_gtfs_realtime

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

@router.post("/jobs")
def create_job(payload: dict):
    return {"status": "queued", "job": payload}

@router.get("/jobs")
def list_jobs():
    return []

@router.get("/jobs/{id}")
def get_job(id: str):
    return {"id": id}

@router.post("/rss")
def ingest_rss(payload: dict):
    return {"items": parse_rss_placeholder(payload.get("source_url", ""))}

@router.post("/gtfs-placeholder")
def gtfs(payload: dict):
    return ingest_gtfs_static(payload.get("source_url", ""))

@router.post("/public-api-placeholder")
def public_api(payload: dict):
    return {"status": "placeholder", "source": payload}

