# Email Routing Live Setup

Code cannot complete provider verification. The owner must verify DNS and mailbox routing before support delivery is considered live.

## Inbound

- Configure DNS records with the provider.
- Verify MX/SPF/DKIM/DMARC where applicable.
- Confirm each routed support address receives mail.

## Outbound

- Select a provider such as Resend.
- Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` server-side only.
- Send a real test message from the deployed environment.

Do not claim support delivery is live until inbound and outbound tests pass.
