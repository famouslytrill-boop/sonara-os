# SONARA — Market Readiness Assessment

**Date:** 2026-07-27
**Question asked:** is the platform ready and sellable to customers within 2–3 days?
**Method:** code and schema verification, live read-only Supabase queries, and a
new smoke test exercising all 366 registered GET routes.

---

## The honest headline

**I cannot certify this platform as sellable, and no engineering work in two
days can produce that certification.** Sellability is not only a code property.
What I *can* do is tell you precisely what is verified, what is untested, and
what is missing — so the launch decision is made on evidence.

The short version: **the machinery is in better shape than the audit implied,
and the gap to launch is mostly not code.**

---

## What is verified working

### Billing — the money path is sound

Traced end to end in code, and it is correctly wired:

1. Checkout sets `subscription_data[metadata][organization_id]` (`server.js:4457`).
2. The webhook reads `subscription.metadata.organization_id` (`server.js:4597`) —
   the two halves agree, so a payment cannot succeed while access silently fails.
3. Signature verification uses `crypto.timingSafeEqual` with a length check
   (`server.js:4206–4209`).
4. Handled events cover the full lifecycle: `checkout.session.completed`,
   `customer.subscription.created`, `.updated`, `.deleted`.
5. Entitlement is written `active` only for `active`/`trialing`, and `disabled`
   for every other status — so **cancellation and payment failure revoke access**.
6. The entitlement gate requires `status=eq.active`, scoped to the organization.

That is the part most likely to lose money if wrong, and it is right.

### Every route responds

New test `tests/all-routes-smoke.test.js` requests **all 366 registered GET
routes**, in both HTML and JSON, unauthenticated and with Supabase unconfigured.
**Zero 5xx.** Previously `smoke:routes` covered 13 routes; the other 353 had
never been requested by any test.

This proves routes *run and make an access decision*. It does not prove pages
are correct, well-designed, or useful.

### Database

- Production project `yqncsonkxgwhcxedgevk` is `ACTIVE_HEALTHY`.
- All migrations applied; the deploy for `f50506a` passed the full
  `verify:db` → `verify-production-supabase` chain.
- 346 tables, RLS enabled broadly, service-role boundary now asserted.

### Auth

Signup, login, logout, password reset, and invite acceptance all exist and are
now rate-limited per-IP and per-account, with durable cross-instance counters.

### Honest degradation

64 routes return explicit `503 setup required` when a dependency is not
configured, rather than faking success. This is a real strength and should not
be "fixed" into silent failure.

---

## What is NOT verified, and cannot be from here

| Area | Status |
|---|---|
| Live production pages | **Unverified.** This sandbox cannot reach `sonaraindustries.com` (proxy returns 403). Route verification is against the app in-process. |
| A real Stripe transaction | **Never executed.** Code is correct; no test card has been run end to end. |
| Email deliverability | **Unverified.** Resend integration exists; no send was performed. |
| UX quality, copy, design | **Not assessed.** Outside what code inspection can answer. |
| Accessibility / Lighthouse | **Not run.** No axe or Lighthouse pass exists. |
| Load behaviour | **Not tested.** No load test at any concurrency. |
| Legal, terms, privacy, tax | **Not assessed.** Not an engineering question. |
| Support readiness | **Not assessed.** A support queue exists; staffing and SLA do not. |

---

## What would actually block a launch

### 1. Nobody has bought anything yet

Production holds **4 profiles and 2 organizations**, and no Stripe transaction
has been executed end to end. The single highest-value pre-launch action is not
more code — it is **one real purchase with a live card**, start to finish:
checkout → webhook → entitlement → paid feature access → cancel → access
revoked. That exercises more risk than any amount of static review.

### 2. Two owner actions are still open

- **Leaked-password protection is disabled** in Supabase Auth. For a product
  taking payment, this should be on before launch. Dashboard-only.
- The production project is still named after a personal account, with a paused
  sibling named `sonara-industries-prod`. Dashboard-only.

### 3. The "AI operating system" positioning has nothing behind it

There is **no inference path of any kind** — no model calls, no embeddings, no
retrieval, no agents. The provider gateway is a readiness detector that states
in its own header that it never makes network calls.

This is not currently a false-advertising problem, and that is worth being
precise about: the customer-facing plan copy promises *records, checklists,
tools, workspaces, and a support queue* — all of which exist. Nothing in the
paid tiers promises AI.

But the stated objective is an "enterprise AI operating system", and that
product does not exist. **Do not market AI capability.** Sell what is built:
guided business, creator, and growth operations with real records and payments.
That is a defensible product. Claiming AI would be the one thing that turns a
sound launch into a misrepresentation.

---

## Recommendation

The platform is **closer to sellable than the audit's critical list suggested**,
because the critical findings were about maintainability and latent risk rather
than broken customer-facing behaviour.

A defensible 2–3 day path to a **small, controlled launch**:

| Day | Action | Owner |
|---|---|---|
| 1 | One real end-to-end purchase and cancellation with a live card | You |
| 1 | Enable leaked-password protection; rename/archive Supabase projects | You |
| 1 | Send one real support and one transactional email; confirm delivery | You |
| 2 | Manually walk signup → workspace → free tool → upgrade → paid feature | You |
| 2 | Fix whatever those three surface | Engineering |
| 3 | Soft launch to a handful of invited users, not a public push | You |

What that path does **not** buy: the `server.js` split, tenant-helper adoption
across all call sites, user-scoped Supabase clients, the AI platform, load
testing, or accessibility. Those remain 15–20 engineer-weeks and should be
scheduled after revenue exists, not before.

**The single most important sentence in this document:** the risk to a launch
right now is not that the code fails — it is that no human has yet completed a
paid customer journey on the live system.
