from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.core.security import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login():
    return {"status": "auth_provider_not_configured"}

@router.post("/logout")
def logout():
    return {"status": "logged_out"}

@router.get("/me")
def me():
    return {"user": None, "status": "anonymous"}

@router.post("/dev-token")
def dev_token():
    if settings.environment not in {"development", "local", "test"}:
        raise HTTPException(status_code=403, detail="dev_token_disabled")
    return {"access_token": "dev-superuser", "token_type": "bearer"}

