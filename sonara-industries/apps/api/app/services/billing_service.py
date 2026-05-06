from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


PLAN_PRICE_ENV: dict[str, dict[str, str]] = {
    "soundos": {
        "starter": "stripe_price_soundos_starter",
        "pro": "stripe_price_soundos_pro",
        "studio": "stripe_price_soundos_studio",
    },
    "tableos": {
        "starter": "stripe_price_tableos_starter",
        "pro": "stripe_price_tableos_pro",
        "multi_location": "stripe_price_tableos_multi_location",
    },
    "alertos": {
        "starter": "stripe_price_alertos_starter",
        "org": "stripe_price_alertos_org",
        "city": "stripe_price_alertos_city",
    },
}


@dataclass(frozen=True)
class EntitlementUpdate:
    organization_id: str | None
    company_key: str
    plan_key: str
    status: str
    source_event_id: str


def get_price_id(company_key: str, plan_key: str) -> str | None:
    env_name = PLAN_PRICE_ENV.get(company_key, {}).get(plan_key)
    if not env_name:
        return None
    return getattr(settings, env_name)


def validate_plan(company_key: str, plan_key: str) -> None:
    if company_key not in PLAN_PRICE_ENV or plan_key not in PLAN_PRICE_ENV[company_key]:
        raise ValueError("invalid_plan")


async def create_checkout_session(payload: dict[str, Any]) -> dict[str, Any]:
    company_key = str(payload.get("company_key", ""))
    plan_key = str(payload.get("plan_key", ""))
    org_id = payload.get("org_id")
    validate_plan(company_key, plan_key)
    price_id = get_price_id(company_key, plan_key)
    missing: list[str] = []
    if not settings.stripe_secret_key:
        missing.append("STRIPE_SECRET_KEY")
    if not price_id:
        missing.append(PLAN_PRICE_ENV[company_key][plan_key].upper())
    if missing:
        return {"ok": False, "error": "Stripe setup required", "missing": missing}

    success_url = f"{settings.next_public_app_url}/billing?checkout=success"
    cancel_url = f"{settings.next_public_app_url}/{company_key}/pricing?checkout=cancelled"
    form = {
        "mode": "subscription",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata[org_id]": str(org_id or ""),
        "metadata[company_key]": company_key,
        "metadata[plan_key]": plan_key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=form,
            auth=(settings.stripe_secret_key or "", ""),
        )
    if response.status_code >= 400:
        return {"ok": False, "error": "Stripe checkout failed", "status_code": response.status_code}
    data = response.json()
    return {"ok": True, "url": data.get("url")}


async def create_customer_portal_session(payload: dict[str, Any]) -> dict[str, Any]:
    customer_id = payload.get("stripe_customer_id")
    if not settings.stripe_secret_key:
        return {"ok": False, "error": "Stripe setup required", "missing": ["STRIPE_SECRET_KEY"]}
    if not customer_id:
        return {"ok": False, "error": "stripe_customer_id required"}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.stripe.com/v1/billing_portal/sessions",
            data={"customer": customer_id, "return_url": f"{settings.next_public_app_url}/billing"},
            auth=(settings.stripe_secret_key or "", ""),
        )
    if response.status_code >= 400:
        return {"ok": False, "error": "Stripe portal failed", "status_code": response.status_code}
    return {"ok": True, "url": response.json().get("url")}


def sign_test_payload(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = timestamp or int(time.time())
    signed_payload = f"{ts}.".encode("utf-8") + payload
    signature = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={signature}"


def verify_stripe_signature(payload: bytes, signature_header: str | None, secret: str | None) -> bool:
    if not secret or not signature_header:
        return False
    try:
        parts = dict(part.split("=", 1) for part in signature_header.split(",") if "=" in part)
    except ValueError:
        return False
    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), f"{timestamp}.".encode("utf-8") + payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def entitlement_update_from_event(event: dict[str, Any]) -> EntitlementUpdate | None:
    event_type = event.get("type", "")
    event_id = event.get("id", "unknown")
    data_object = event.get("data", {}).get("object", {})
    metadata = data_object.get("metadata", {}) or {}
    company_key = metadata.get("company_key") or "soundos"
    plan_key = metadata.get("plan_key") or "starter"
    org_id = metadata.get("org_id")
    if event_type in {"customer.subscription.deleted", "invoice.payment_failed"}:
        status = "inactive"
    elif event_type in {
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "invoice.payment_succeeded",
    }:
        status = data_object.get("status") or "active"
    else:
        return None
    return EntitlementUpdate(
        organization_id=org_id,
        company_key=company_key,
        plan_key=plan_key,
        status=status,
        source_event_id=event_id,
    )


def handle_verified_webhook_event(payload: bytes) -> dict[str, Any]:
    event = json.loads(payload.decode("utf-8"))
    update = entitlement_update_from_event(event)
    return {
        "received": True,
        "event_id": event.get("id"),
        "event_type": event.get("type"),
        "entitlement_update": update.__dict__ if update else None,
    }
