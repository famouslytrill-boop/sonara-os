# SSL Live Setup

SSL is required before public launch.

## Verify

- Production domain serves HTTPS.
- Certificate is active and trusted.
- HTTP redirects to HTTPS.
- Root and `www` behavior is documented.
- No mixed content appears in browser devtools.

## Blockers

- Expired or missing certificate.
- Production metadata pointing to localhost.
- Public app routes loading insecure assets.
