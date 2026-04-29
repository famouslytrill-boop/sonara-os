from fastapi import APIRouter
from app.core.product_surface import get_public_navigation, get_platform_areas, HERO_ENGINES, FOUNDER_DOCTRINE
from app.services.recovery_mode import RecoveryMode

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/surface")
async def surface():
    return {
        "brand": "SONARA",
        "category": "Music identity and release-readiness",
        "motto": "Every song gets a fingerprint. Every release gets a plan.",
        "navigation": get_public_navigation(),
        "platform_areas": get_platform_areas(),
        "hero_engines": HERO_ENGINES,
        "founder_doctrine": FOUNDER_DOCTRINE,
    }

@router.get("/recovery")
async def recovery():
    status = RecoveryMode().evaluate()
    return status.__dict__
