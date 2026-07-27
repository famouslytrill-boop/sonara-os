from fastapi import APIRouter

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
def logs():
    return []

@router.get("/access-events")
def access_events():
    return []

