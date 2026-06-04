# SSL and Domain Security

## Checklist

- Production domain resolves.
- HTTPS is active.
- HTTP redirects to HTTPS.
- Canonical domain is documented.
- Supabase Auth redirects use HTTPS production URLs.
- Security headers are generated in the static build.
- Robots and sitemap use the production canonical URL.

Do not launch with localhost, preview-only, or malformed public URLs in production metadata.
