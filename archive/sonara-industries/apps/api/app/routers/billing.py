from fastapi import APIRouter, HTTPException, Request
from app.core.config import settings
from app.services.billing_service import create_checkout_session, create_customer_portal_session, handle_verified_webhook_event, verify_stripe_signature

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/plans")
def plans():
    return {"product_groups": ["soundos", "tableos", "alertos"]}

@router.post("/create-checkout-session")
async def checkout(payload: dict):
    try:
        return await create_checkout_session(payload)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_plan")

@router.post("/create-portal-session")
async def create_portal_session(payload: dict):
    return await create_customer_portal_session(payload)

@router.post("/webhook")
async def webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="stripe_webhook_setup_required")
    if not verify_stripe_signature(payload, signature, settings.stripe_webhook_secret):
        raise HTTPException(status_code=400, detail="invalid_stripe_signature")
    return handle_verified_webhook_event(payload)

@router.get("/subscription/{org_id}")
def get_subscription(org_id: str):
    return {"organization_id": org_id, "status": "not_loaded"}
