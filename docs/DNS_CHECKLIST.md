# DNS Checklist

## Production Domain

- Use `sonaraindustries.com` as the canonical host for launch.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical host exactly.
- Decide redirect behavior before launch:
  - root domain redirects to `www`, or
  - `www` redirects to root.
- Keep one canonical host in public metadata and sitemap output.
- Keep Business Builder, Creator Studio, and Growth Studio on this same domain.

## Vercel DNS

- Add the root domain in Vercel Domains.
- Add the `www` domain if it will be used.
- Follow Vercel's displayed DNS records for the registrar.
- Wait for DNS verification before launch review.
- Do not edit Vercel project root/build settings as part of DNS work.

## Custom Hosting DNS

- Point the domain to the host-provided A, AAAA, CNAME, or ALIAS record.
- Avoid mixed provider records for the same host.
- Keep staging and production on separate hostnames.
- Confirm the static root serves `packages/web/dist`.

## Required Checks

```bash
nslookup your-domain.example
nslookup www.your-domain.example
```

Check in browser:

- `https://your-domain.example/`
- `https://your-domain.example/robots.txt`
- `https://your-domain.example/sitemap.xml`
- `https://your-domain.example/api/health`

## Blockers

- DNS still points to an old host.
- Root and `www` show different apps.
- Sitemap uses a different host than `NEXT_PUBLIC_SITE_URL`.
- Production metadata contains localhost or preview URLs.
