from fastapi import FastAPI
from prometheus_client import make_asgi_app
from app.api.evolution import router as evolution_router
from app.api.navigation import router as navigation_router
from app.api.ai import router as ai_router
from app.api.system import router as system_router
from app.core.license_firewall import APPROVED_TECH, LicenseFirewall

app = FastAPI(title="SONARA API", version="27.0.0")
app.include_router(evolution_router)
app.include_router(navigation_router)
app.include_router(ai_router)
app.include_router(system_router)
app.mount("/metrics", make_asgi_app())

@app.get("/health")
async def health():
    firewall = LicenseFirewall()
    return {
        "status": "online",
        "brand": "SONARA",
        "version": "v27",
        "approved_tech_count": len([t for t in APPROVED_TECH if firewall.can_ship(t)]),
        "public_modules": 5,
    }

@app.get("/ready")
async def ready():
    return {"status": "ready", "required_systems": ["auth", "payments", "exports", "vault", "liveos", "ask_sonara"]}

@app.get("/live")
async def live():
    return {"status": "live"}
