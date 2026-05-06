import json

from app.services.billing_service import handle_verified_webhook_event, sign_test_payload, verify_stripe_signature


def test_webhook_signature_failure():
    payload = b'{"id":"evt_bad","type":"checkout.session.completed"}'
    assert verify_stripe_signature(payload, "t=1,v1=bad", "test_webhook_secret") is False


def test_valid_event_processing_and_entitlement_update():
    event = {
        "id": "evt_test",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "status": "active",
                "metadata": {"org_id": "org_1", "company_key": "soundos", "plan_key": "pro"},
            }
        },
    }
    payload = json.dumps(event).encode("utf-8")
    signature = sign_test_payload(payload, "test_webhook_secret", timestamp=123)
    assert verify_stripe_signature(payload, signature, "test_webhook_secret") is True
    result = handle_verified_webhook_event(payload)
    assert result["received"] is True
    assert result["entitlement_update"]["company_key"] == "soundos"
    assert result["entitlement_update"]["plan_key"] == "pro"
