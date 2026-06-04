# Outbound Email Provider

Support/contact notification delivery requires a reviewed outbound provider such
as Resend, Postmark, or another owner-approved service.

## Required setup

1. Verify the sender domain with the provider.
2. Configure the provider key server-side only.
3. Configure `RESEND_FROM_EMAIL` or the selected provider sender.
4. Send a provider test email.
5. Submit a support form and verify notification delivery.

If outbound email is not configured, the app must show:

`Request received. Email notification is not configured yet.`

Do not expose provider errors, provider keys, or mailbox tokens to public users.
