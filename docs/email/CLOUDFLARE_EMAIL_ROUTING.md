# Cloudflare Email Routing

Cloudflare Email Routing handles inbound forwarding only. It does not send
outbound application mail.

## Manual checklist

1. Enable Email Routing in Cloudflare.
2. Verify the Destination mailbox.
3. Create routes for `support@`, `contact@`, `help@`, `billing@`,
   `security@`, `privacy@`, and `legal@`.
4. Confirm MX records are active.
5. Confirm TXT records required by Cloudflare are active.
6. Send inbound test messages to each alias.
7. Verify the real owner-controlled inbox receives the messages.
8. Review SPF, DKIM, and DMARC alignment for the outbound provider domain.

Outbound notifications require a separate provider and verified sender domain.
