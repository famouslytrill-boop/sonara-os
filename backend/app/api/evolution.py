from fastapi import APIRouter
from app.services.product_evolution_engine import ProductEvolutionEngine

router = APIRouter(prefix="/evolution", tags=["evolution"])

@router.post("/audit")
async def audit_product(metrics: dict):
    engine = ProductEvolutionEngine()
    signals = engine.audit(metrics)
    return engine.summarize(signals)

@router.get("/health")
async def health():
    return {"status": "online", "engine": "product_evolution_v2"}
