from fastapi import APIRouter
from app.services.ingestion_service import data_gov_metadata_placeholder, ingest_gtfs_static, ingest_gtfs_realtime, nws_weather_placeholder, parse_local_csv_upload, parse_local_json_upload, parse_rss_placeholder

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

@router.post("/data-gov")
def data_gov(payload: dict):
    return data_gov_metadata_placeholder(payload.get("query", ""))

@router.post("/weather-placeholder")
def weather(payload: dict):
    return nws_weather_placeholder(payload.get("zone_or_point", ""))

@router.post("/local-csv")
def local_csv(payload: dict):
    return {"items": parse_local_csv_upload(payload.get("content", ""))}

@router.post("/local-json")
def local_json(payload: dict):
    return {"items": parse_local_json_upload(payload.get("content", "{}"))}
