# Domain DNS Launch Checklist

## Required Checks

- Apex/root domain points to the production host.
- `www` redirects to the canonical domain.
- SSL certificate is active.
- `NEXT_PUBLIC_SITE_URL` matches the canonical production URL.
- Supabase Auth redirect URLs include the production callback and reset URLs.
- Cloudflare Email Routing MX/TXT records are verified if inbound email is used.
- SPF, DKIM, and DMARC are configured for the outbound email provider.

Repository code cannot verify DNS ownership without provider access.
