# SONARA public support and contact setup

Date reviewed: 2026-10-08
Status: source-code contract, not proof of live email delivery.

This runbook covers the same backend used by the SONARA Industries website, Business Builder™, Creator Studio™ and Growth Studio™. The two public write paths have different front doors but share validation, request storage, email dispatch and an abuse budget.

## Routes and request outcomes

| Route | Purpose | Sign-in |
| --- | --- | --- |
| `GET /contact` | Public question/contact page | No |
| `POST /contact` | Public support request submission | No |
| `GET /support` | Public support center; account-specific requests visible only when authenticated and authorized | No for public content |
| `POST /support/request` | Support-center request submission | No |
| `GET /help` | Help and FAQ | No |
| `GET /tutorials` | Guided product instructions | No |

Both Express POST endpoints pass through the same rate limiter, validators and `saveSupportRequest()`. A durable Postgres RPC provides the distributed rate decision. **Production support/contact submissions fail HTTP 503 rather than send mail or store a record when that durable decision is unavailable**; a bounded per-process fallback remains available for development and other explicitly approved routes. The browser-facing Supabase tables currently have overly broad direct grants and an anonymous INSERT policy that can bypass Express entirely; see `docs/security/PROPOSED_SUPPORT_BROWSER_GRANTS_2026-10-08.sql` for a non-applied staging fix. Do not claim end-to-end protection until database grants are hardened.

A successfully stored row gets a reference ID whether or not an email notification succeeds. If storage fails but the email provider accepts the request, the response says acceptance is **not verified inbox delivery**. If both fail, return HTTP 503 and **no reference ID**; there is no fallback queue.

The shared form labels all fields, warns against sending secrets, and caps name (120), email (254), subject (160), and message (4000) characters. The hidden honeypot is supplemental; automated clients may omit it. An unvalidated body, missing consent or filled honeypot must not reach storage or the mail provider.

## Current runtime email configuration

The authoritative requirement list is `lib/sonara-infrastructure-manifest.cjs`, used by `scripts/verify-email-env.mjs` and readiness checks.

- `RESEND_API_KEY`: secret, server side only.
- `RESEND_FROM_EMAIL`: verified sending address.
- `SUPPORT_TO_EMAIL` or `CONTACT_TO_EMAIL`: destination that actually receives support notifications.
- Optional other email workflows have their **own** provider and permission requirements. Supabase Auth SMTP, campaign delivery, and support notifications are not interchangeable.

The legacy `SUPPORT_EMAIL` and `CONTACT_EMAIL` names are not read by the support notification runtime. Do not claim they configure delivery; keep aliases and DNS records consistent with the actual sender and recipient.

Cloudflare Email Routing can forward incoming mail, but is not an outbound SMTP provider. Public contact text must not advertise an inbox that has not been confirmed active.

## Operational verification

1. Run `pnpm run verify:email-env -- --strict` with staging values; do not publish environment contents.
2. Run `pnpm run test:email` for a local dry run. Only `pnpm run test:email -- --send` attempts a real provider message; use an approved staging destination.
3. Verify the sender domain, SPF/DKIM, DMARC alignment where applicable, provider acceptance, bounce/suppression handling and actual inbox receipt. A provider HTTP 2xx does **not** prove delivery.
4. Test both POST routes for 400 validation, 429 abuse throttling, 503 write-and-email failure, safe redaction, and tenant-isolated request-history access.
5. Monitor the existing structured `support.request_submission` and `rate_limit.degraded` events without putting names, email addresses, messages or raw IP values into logs.
6. Audit the legal/privacy wording, retention/deletion obligations, contact channels and incident escalation contacts before live customer activation.

## Cross-suite help and security expectations

Every page built by the shared page frame exposes consistent About, Help and FAQs, Tutorials, Contact, Support, Security, Accessibility and canonical legal links. Each product tutorial must give a working route to its relevant task plus a support/recovery destination. Authentication and tenant authorization are **server-enforced**, not satisfied by displaying a link or hiding a control.

Current legal notices are drafts requiring human review. Do not present a published notice, untested sender, unconfigured payment provider or security assurance as verified solely because a route renders.

## Related authorities

- `lib/sonara-trust-navigation.cjs`
- `lib/sonara-shell.cjs`
- `server.js`
- `routes/sonara-service-lifecycle-routes.cjs`
- `lib/sonara-rate-limit.cjs`
- `lib/sonara-support-outcome.cjs`
- `docs/security/PUBLIC_TRUST_SUPPORT_ENGINEERING_2026-10-08.md`
- `docs/legal/2026-09-23-LEGAL-TERMS-TRADEMARK-GOVERNANCE.md`

References: https://owasp.org/projects/asvs, https://www.w3.org/TR/WCAG22/, https://supabase.com/docs/guides/api/securing-your-api, https://resend.com/docs/webhooks/introduction.
