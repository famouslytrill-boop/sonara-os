PRODUCT_GROUPS = {"sonara_one": [], "tableops": [], "civic_signal": []}

def create_checkout_session_placeholder(app: str, plan_code: str) -> dict:
    return {"app": app, "plan_code": plan_code, "checkout_url": None, "status": "stripe_setup_required"}

def handle_webhook_placeholder(event: dict) -> dict:
    return {"received": True, "event_type": event.get("type", "unknown")}

