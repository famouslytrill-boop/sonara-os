# Domain Setup

## Purpose

Connect SONARA One to a production custom domain without changing the app build root, hiding SSL problems, or hardcoding localhost metadata.

## Required Public Env Vars

Set these in the hosting provider for production and preview/staging environments:

```bash
NEXT_PUBLIC_SITE_URL=https://sonaraindustries.com
NEXT_PUBLIC_APP_URL=https://sonaraindustries.com/app
NEXT_PUBLIC_MARKETING_URL=https://sonaraindustries.com
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
NEXT_PUBLIC_COMPANY_NAME=SONARA Industries
NEXT_PUBLIC_PLATFORM_NAME=SONARA One
```

`NEXT_PUBLIC_*` values are browser-exposed. Do not put tokens, secrets, private URLs, service-role keys, webhook secrets, or provider API keys in these values.

## Canonical Domain

`NEXT_PUBLIC_SITE_URL` is the canonical public origin used by generated metadata, `robots.txt`, `sitemap.xml`, and the static `/api/health` response. Use the final public domain in production. Use a separate preview/staging URL in non-production environments.

## Vercel Setup

1. In Vercel, open the project settings.
2. Add the domain under Domains.
3. Add the public env vars under Environment Variables for Production and Preview.
4. Redeploy after env vars are saved.
5. Confirm the build serves:
   - `/`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/site.webmanifest`
   - `/api/health`

Do not change the build output location without validating the generated web `dist` output.

## Custom Hosting Setup

1. Build with `pnpm run build`.
2. Serve `packages/web/dist` as the static web root.
3. Configure clean fallback routing to `index.html` for app routes.
4. Serve `/api/health` as the generated static JSON file at `packages/web/dist/api/health`.
5. Ensure `robots.txt`, `sitemap.xml`, `site.webmanifest`, favicon, and `/brand/*` assets are served from the same origin.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm run build
```

Then verify:

```bash
curl -I https://your-domain.example/
curl https://your-domain.example/api/health
curl https://your-domain.example/robots.txt
curl https://your-domain.example/sitemap.xml
```

Expected result: HTTPS works, `/api/health` returns JSON with `ok: true`, and generated metadata does not reference localhost.
