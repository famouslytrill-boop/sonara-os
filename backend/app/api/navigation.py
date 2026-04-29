from fastapi import APIRouter
from app.core.product_surface import get_public_navigation

router = APIRouter(prefix="/nav", tags=["navigation"])

@router.get("/")
async def nav():
    return {"modules": get_public_navigation()}
