# Locks

Active:
- HELD: inventory/order/fulfilment linkage -- Claude, branch
  `claude/sonara-engineering-handoff-b6ui1t`, taken 2026-10-06. Covers a new
  `inventory_reservations` table and its stock functions,
  `lib/sonara-merchant-storefront.cjs`, `routes/sonara-merchant-store-routes.cjs`
  (availability, reserve on order, fulfil/cancel moving stock), and the
  `merchant_product_variants` / `business_work_order_materials` stock link. Does
  not touch payments, webhooks or billing. Release when its PR merges or closes.

History:
- RELEASED: commerce webhook recovery -- Codex, branch `codex/commerce-recovery-20261006`, completed locally 2026-10-06. Marketplace and merchant webhook recovery and inventory lineage are tested; public publication awaits owner approval after automatic review rejected the upload.
- RELEASED: connected-account commerce payment surfaces -- Claude, branch
  `claude/sonara-engineering-handoff-b6ui1t`, PR #436, taken 2026-10-06. Covers
  `lib/sonara-connected-checkout.cjs`, `lib/sonara-marketplace-orders.cjs`,
  `lib/sonara-merchant-payments.cjs`, `routes/sonara-marketplace-checkout-routes.cjs`,
  `routes/sonara-merchant-store-routes.cjs`, the `/api/webhooks/stripe-connect`
  mount in `server.js`, and migrations touching `merchant_orders` or
  `creator_marketplace_*`. Platform billing (`lib/sonara-billing.cjs`) and invoice
  settlement (`lib/sonara-invoice-settlement.cjs`) are NOT locked -- Codex's
  surface, untouched by this work. Released: PR #436 merged at d926cad on 2026-10-06.

- RELEASED: immutable checkout/setup-python v7 action pins — Codex, verified locally 2026-09-18.
- RELEASED: production connectivity hardening — Codex, PR #36, merge `aebee84129f3488d91bc51ea81aa0f8c423fc8e7`, deployment `dpl_7RzByXjMYwGp7C78CuNVC6AuiV8Q`, 2026-07-19.
- RELEASED: cohesive 2027 public frontend, canonical runtime registry, production deployment, and live readiness-backed database presentation — Codex, PR #34, merge `988afc643b4c4633c1843e4d854b899782a8669a`, deployment `dpl_Gaa2kkogk3mPkFkUE6QcaM7TH1sG`, 2026-07-19.
- MERGED / AUTHENTICATED SMOKE PENDING: organization setup schema compatibility — Codex, PR #33, 2026-07-19.
- RELEASED: readiness Preview UI repair — Codex, completed 2026-07-19.
- RELEASED: payload-size request handling — Codex, completed 2026-07-19 in PR #30.
- RELEASED: retry/shared-state reconciliation — Codex, completed 2026-07-19.
- RELEASED: paid-launch finalization — Codex, completed 2026-07-18 in PR #27.
- RELEASED: database query/index hardening — Codex, completed 2026-07-18 in PR #25.
- RELEASED: canonical PWA contract — Codex, completed 2026-07-18 in PR #23.
