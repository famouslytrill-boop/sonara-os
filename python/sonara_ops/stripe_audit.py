from sonara_ops.config import get_settings


def stripe_audit_summary() -> dict[str, object]:
    settings = get_settings()
    return {
        "stripe_secret_configured": settings.has_stripe_secret,
        "checks": [
            "Confirm webhook endpoint verifies Stripe signatures.",
            "Confirm stripe_events or billing_events stores processed event IDs idempotently.",
            "Confirm subscription writes use server-only Supabase service role.",
            "Confirm no Stripe secrets are committed or printed.",
        ],
    }
