# Support Email Routing Checklist

## Inbound

- Cloudflare Email Routing enabled.
- Destination mailbox verified.
- `support@` route created.
- `contact@` route created.
- `help@` route created.
- `billing@` route created.
- `security@` route created.
- `privacy@` route created.
- `legal@` route created.
- MX records active.
- SPF, DKIM, and DMARC reviewed for the outbound provider.
- Real inbox delivery tested.

## Outbound

- Provider selected and approved.
- Sender domain verified.
- Server-only provider key configured.
- Sender email configured.
- Test notification delivered.

## Form safety

Forms must never request passwords, card numbers, raw bank details, API keys,
private keys, or provider secrets.
