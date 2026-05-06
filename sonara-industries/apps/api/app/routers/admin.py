from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/overview")
def overview():
    return {"organizations": 0, "users": 0, "subscriptions": 0, "security_events": 0}

@router.get("/organizations")
def organizations():
    return []

@router.get("/users")
def users():
    return []

@router.get("/billing")
def billing():
    return []

@router.get("/security-events")
def security_events():
    return []

@router.get("/system-health")
def system_health():
    return []

