from fastapi import APIRouter, Request
from app.services.billing_service import create_checkout_session_placeholder, handle_webhook_placeholder

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/plans")
def plans():
    return {"product_groups": ["sonara_one", "tableops", "civic_signal"]}

@router.post("/create-checkout-session")
def create_checkout_session(payload: dict):
    return create_checkout_session_placeholder(payload.get("app", "sonara_one"), payload.get("plan_code", "free"))

@router.post("/create-portal-session")
def create_portal_session():
    return {"status": "stripe_portal_setup_required"}

@router.post("/webhook")
async def webhook(request: Request):
    # TODO: verify Stripe signature using STRIPE_WEBHOOK_SECRET before persistence.
    return handle_webhook_placeholder(await request.json())

@router.get("/subscription/{org_id}")
def get_subscription(org_id: str):
    return {"organization_id": org_id, "status": "not_loaded"}

