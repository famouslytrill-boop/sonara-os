# SSL Checklist

## Goal

Public launch requires valid HTTPS on the canonical domain and any redirect host. Do not launch with certificate warnings or mixed-content warnings.

## Vercel SSL

- Add the domain in Vercel.
- Wait for Vercel to issue the certificate.
- Confirm the domain shows as valid in Vercel Domains.
- Test both root and `www` behavior.

## Custom Hosting SSL

- Enable managed TLS or install a certificate for every public host.
- Redirect HTTP to HTTPS.
- Confirm the certificate covers the exact hostname.
- Confirm the certificate renewal path is automatic or documented.

## Browser Checks

- Visit `https://your-domain.example/`.
- Confirm the browser shows a valid lock.
- Open DevTools and check for mixed-content warnings.
- Visit `/site.webmanifest`, `/robots.txt`, `/sitemap.xml`, and `/api/health` over HTTPS.

## Command Checks

```bash
curl -I https://your-domain.example/
curl -I http://your-domain.example/
curl https://your-domain.example/api/health
```

Expected result: HTTPS succeeds, HTTP redirects or is blocked by the host policy, and `/api/health` returns JSON.

## Blockers

- Expired, self-signed, or wrong-host certificate.
- HTTP serving production pages without redirect.
- Mixed-content errors from non-HTTPS images, scripts, styles, or manifest links.
- Preview/staging domain accidentally configured as production canonical URL.
