# Cloudflare Email Routing Checklist

- Verify the domain in Cloudflare.
- Add or confirm MX records.
- Add or confirm SPF, DKIM, and DMARC policy records where required.
- Create routes for support, contact, billing, security, privacy, legal, and help addresses.
- Send inbound test messages to each route.
- Confirm the destination inbox receives messages.
- Document route owners outside source control.

Cloudflare Email Routing handles inbound forwarding only. Outbound messages still require a separate provider.
