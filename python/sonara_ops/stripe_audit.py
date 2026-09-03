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
            "Open question: Stripe does not guarantee event order, and merge-duplicates keyed on the "
            "subscription reference has no version column, so a late customer.subscription.updated can "
            "overwrite newer state.",
            "Confirm subscription writes use server-only Supabase service role.",
            "Confirm no Stripe secrets are committed or printed.",
        ],
    }
