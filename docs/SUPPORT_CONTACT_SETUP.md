# Support Contact Setup

## Required owner/provider setup

1. Choose the real support inbox owner.
2. Configure inbound routing in Cloudflare Email Routing or the selected provider.
3. Verify DNS/MX/SPF/DKIM/DMARC.
4. Configure `SUPPORT_EMAIL`, `SUPPORT_TO_EMAIL`, `CONTACT_EMAIL`, `HELP_EMAIL`, `BILLING_EMAIL`, `SECURITY_EMAIL`, `PRIVACY_EMAIL`, and `LEGAL_EMAIL`.
5. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` only if outbound email is enabled.
6. Configure `SONARA_ADMIN_EMAILS` with comma-separated owner/admin email addresses.
7. Send a real provider test email from the deployed environment.

## Production request path

1. Public users submit `/contact`.
2. The browser posts to `/api/contact`.
3. The server validates the request, rejects honeypot spam, and stores a `support_requests` row using `SUPABASE_SERVICE_ROLE_KEY`.
4. The server sends a Resend notification when `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `SUPPORT_TO_EMAIL` or `SUPPORT_EMAIL` are configured.
5. The support row is updated to `pending_email`, `email_sent`, or `email_failed`.
6. Admin review uses `/admin/support` and `/api/admin/contact-requests`. The API requires a Supabase user bearer token whose email appears in `SONARA_ADMIN_EMAILS`.

## Degraded behavior

If email delivery is unavailable, forms and pages must show calm fallback guidance and a reference ID. Database-backed support records should remain reviewable with one of these delivery states:

- `pending_email`
- `email_sent`
- `email_failed`

Code must not claim mail was delivered unless a provider confirms it. Failed email notifications should keep sanitized error details only and remain retryable from an admin/support queue.

## Secret handling

Never commit support provider secrets. Never paste real provider secrets into public docs, browser code, support messages, screenshots, or AI prompts.
