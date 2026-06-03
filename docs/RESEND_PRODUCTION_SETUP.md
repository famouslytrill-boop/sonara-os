# Resend Production Setup

Outbound email is optional and must fail safely when not configured.

## Required Env For Sending

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Support Recipient Env

- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`

## Setup Steps

1. Verify the sending domain in Resend.
2. Configure DNS records required by Resend.
3. Set `RESEND_API_KEY` in Vercel.
4. Set `RESEND_FROM_EMAIL` to a verified sender.
5. Set support recipient emails.
6. Redeploy.
7. Submit a test support/contact request.
8. Confirm no API key appears in logs or browser output.

## Current Behavior

Support and feedback forms validate input and can store records through Supabase when configured. Outbound delivery remains disabled until a reviewed provider adapter is enabled.
