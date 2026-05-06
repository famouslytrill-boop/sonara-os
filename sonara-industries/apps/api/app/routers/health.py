from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok", "service": "sonara-industries-api"}

@router.get("/health/deep")
def deep_health():
    return {"status": "ok", "database": "not_checked", "redis": "not_checked"}

