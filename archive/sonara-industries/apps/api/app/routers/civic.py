from fastapi import APIRouter
from app.services.civic_service import create_public_feed_source, ingest_public_feed, create_organization_profile

router = APIRouter(prefix="/civic", tags=["civic"])

@router.get("/feed")
def feed():
    return []

@router.post("/feed/source")
def source(payload: dict):
    return create_public_feed_source(payload)

@router.post("/feed/ingest")
def ingest(payload: dict):
    return ingest_public_feed(payload)

@router.get("/organizations")
def organizations():
    return []

@router.post("/organizations/profile")
def profile(payload: dict):
    return create_organization_profile(payload)

@router.get("/alerts")
def alerts():
    return []

@router.get("/transit")
def transit():
    return {"items": [], "status": "gtfs_placeholder"}

