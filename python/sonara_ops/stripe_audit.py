from sonara_ops.config import get_settings


def stripe_audit_summary() -> dict[str, object]:
    settings = get_settings()
    return {
        "stripe_secret_configured": settings.has_stripe_secret,
        "checks": [
            "Confirm webhook endpoint verifies Stripe signatures.",
            # Was "Confirm stripe_events or billing_events stores processed
            # event IDs idempotently." Neither table exists -- not in any
            # migration, not anywhere in lib/, routes/ or server.js -- so the
            # item sent whoever ran it hunting for two tables that were never
            # the mechanism, and the honest answer looked like "no" when it is
            # "yes, differently".
            #
            # What is there: billing_webhook_events, upserted on
            # (provider, provider_event_id) with resolution=ignore-duplicates.
            # And the part that actually makes a retry safe is not that check --
            # synchronizeBillingFromStripeEvent runs on every delivery. Every
            # write it makes is an upsert on a natural key with
            # resolution=merge-duplicates, so a second delivery writes the same
            # state to the same row.
            "Confirm billing_webhook_events upserts on (provider, provider_event_id).",
            "Confirm every billing write stays an on_conflict upsert with merge-duplicates: "
            "the sync runs on every delivery, so that is what makes a Stripe retry a no-op.",
            # Was an open question. Closed 3 September 2026 by migration
            # 20260903120000: provider_event_at carries the stamp Stripe put on
            # the event, and a before-update trigger discards a write carrying
            # an older one. In the database rather than the application because
            # read-then-write is a race, and the thing racing is two deliveries
            # of the same subscription -- which is what Stripe's retries make.
            "Confirm billing_subscriptions and billing_entitlements still carry provider_event_at, and that "
            "sonara_reject_stale_provider_event is still the trigger on both: Stripe does not guarantee event "
            "order, and without it a late customer.subscription.updated overwrites newer state.",
            "Confirm subscription writes use server-only Supabase service role.",
            "Confirm no Stripe secrets are committed or printed.",
        ],
    }
