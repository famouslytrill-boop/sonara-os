# Support Contact Setup

## Required owner/provider setup

1. Choose the real support inbox owner.
2. Configure inbound routing in Cloudflare Email Routing or the selected provider.
3. Verify DNS/MX/SPF/DKIM/DMARC.
4. Configure `SUPPORT_EMAIL`, `CONTACT_EMAIL`, `HELP_EMAIL`, `BILLING_EMAIL`, `SECURITY_EMAIL`, `PRIVACY_EMAIL`, and `LEGAL_EMAIL`.
5. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` only if outbound email is enabled.
6. Send a real provider test email from the deployed environment.

## Degraded behavior

If email delivery is unavailable, forms and pages must show clear fallback guidance. Code must not claim mail was delivered unless a provider confirms it.

## Secret handling

Never commit support provider secrets. Never paste real provider secrets into public docs, browser code, support messages, screenshots, or AI prompts.
