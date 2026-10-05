# Purchase and upload readiness

Checked: 2026-10-05
Review by: 2026-10-12

## Verified production state

Production serves commit `6cf6e4889b061330606845b6c97f847be32c397b`.
The current route smoke passes 314 assertions. The focused account, price,
payment replay, seller account, listing and file tests pass 121 assertions.
These checks do not prove a live purchase or a new customer's complete journey.

The live Stripe account selected by the owner is `sos`. Its enabled endpoint
at `https://sonaraindustries.com/api/webhooks/stripe` subscribes to checkout
completion and subscription creation, update and deletion. It does not subscribe
to `checkout.session.async_payment_succeeded`, which the billing handler already
accepts. The dashboard correction is pending successful Stripe authentication.
Do not describe it as applied.

Creator Marketplace currently has zero published catalogue entries and zero
connected seller payment accounts. Listing clearance exists; buyer checkout and
paid digital delivery do not. Do not invent seller accounts, ownership,
attestations or commercial listings to make readiness checks pass.

## Required commerce implementation

1. Bind an order to an authenticated buyer and a currently cleared listing.
   Snapshot its immutable version, licence, currency, price and delivery object.
   Resolve the seller organization on the server, and re-read connected account
   charge eligibility at checkout. Do not use cached flags for money decisions.
2. Create hosted Checkout on the seller's connected Stripe account using direct
   charges. Preserve the zero seller commission policy. Never accept an amount,
   seller account, delivery path or organization authority from a buyer's form.
   Use a stable order identifier for idempotency and bounded provider timeouts.
3. Fulfill from signed, account-bound webhook events, including delayed success.
   Verify session, order, account, amount, currency and paid status before an
   atomic, replay-safe entitlement write. The success page grants no access.
   Exclusive licences require a reservation and atomic single-buyer settlement.
4. Give only the purchasing buyer a short-lived signed download of the recorded
   version. Later asset replacement must not change what the buyer purchased.
   Test cross-buyer denial, replay, failed payment, withdrawn approval,
   exclusive-sale races and unavailable storage before production enablement.
5. Verify sandbox signup, login, logout, seller onboarding, checkout, delayed
   payment and delivery as one journey. A real seller must complete Stripe's
   identity and onboarding requirements. Any live charged test needs an owner
   specified amount; it is not implied by read-only payment verification.

## Larger and more files

The existing asset attachment buffers multipart bytes through the application
and advertises a 12 MiB limit. Vercel Functions have a 4.5 MB request/response
payload limit. Raising the Express limit does not raise the hosting limit.
The production Supabase project is Free: global file size cannot exceed 50 MB.
Creator, export, stem and release buckets currently have 50 MiB bucket limits;
the effective maximum is the smaller global and bucket value. Business assets
are 25 MiB, attachments 15 MiB and avatars 5 MiB. Database size is about 38 MiB.
All public database tables have RLS enabled. Public marketing assets have a
separate public bucket; customer file buckets must remain private.

| Path | Purpose | Requirement |
| --- | --- | --- |
| Direct signed upload | Files bypass the application body limit | Server assigns an owned unique object path and restricted upload token |
| TUS resumable upload | Larger files and interrupted mobile connections | Direct storage hostname, progress/resume UI and provider-prescribed 6 MiB chunks |
| Supabase paid capacity | Files beyond the Free plan maximum and more aggregate storage | Owner-approved plan and spending limit; verify global and per-bucket limits |
| S3-compatible multipart storage | Large media libraries | Provider credentials, explicit quota/cost policy and maintained private access boundary |

Before attaching an uploaded object to a customer record, verify its actual
existence, size, type and ownership on the server. Quarantine unvalidated media;
record processing states, reject overwrites, and clean abandoned uploads with a
reviewable retention policy. File counts, total bytes, bandwidth, processing
concurrency and duration need separate quotas. A larger single-file limit does
not expand total capacity or authorize device-wide file access. Browser and phone
file access must remain user initiated. Stream or download from signed storage
URLs rather than proxying large response bodies through a serverless function.

## Primary sources

- [Stripe direct charges](https://docs.stripe.com/connect/direct-charges)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Supabase upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase resumable uploads and signed tokens](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

These pathways are researched design requirements, not deployed capabilities.
