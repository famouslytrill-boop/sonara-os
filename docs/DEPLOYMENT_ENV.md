# Deployment Environment

## Public Variables

These values are safe to expose in the browser and are used by the static build for metadata, canonical URLs, generated deployment config, robots, sitemap, and health output.

| Variable                    | Purpose                                       | Example                            |
| --------------------------- | --------------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | Canonical public site URL                     | `https://sonaraindustries.com`     |
| `NEXT_PUBLIC_APP_URL`       | App entry URL under the same canonical domain | `https://sonaraindustries.com/app` |
| `NEXT_PUBLIC_MARKETING_URL` | Marketing/public URL                          | `https://sonaraindustries.com`     |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public support contact                        | `support@example.com`              |
| `NEXT_PUBLIC_COMPANY_NAME`  | Public company name                           | `SONARA Industries`                |
| `NEXT_PUBLIC_PLATFORM_NAME` | Public platform name                          | `SONARA Industries`                |

## Private Variables

Private secrets must stay server-side or in hosting provider secret storage. Do not expose these through `NEXT_PUBLIC_*`.

- Supabase service-role keys
- Stripe secret keys
- Stripe webhook secrets
- AI provider API keys
- Private database URLs
- Any token that can read or write private customer data

## Generated Build Outputs

The web package build writes these deployment files into `packages/web/dist`:

- `deployment-config.mjs`
- `robots.txt`
- `sitemap.xml`
- `api/health`
- `site.webmanifest`
- `favicon.svg`

`deployment-config.mjs` contains public values only. It must not contain localhost, service-role keys, webhook secrets, API keys, or private credentials.

## Local Validation

```bash
pnpm install --frozen-lockfile
pnpm run validate:infrastructure
pnpm run typecheck
pnpm run build
pnpm run smoke
```

## Production Validation

After deployment, verify:

```bash
curl https://your-domain.example/api/health
curl https://your-domain.example/robots.txt
curl https://your-domain.example/sitemap.xml
```

Also inspect the page source for:

- canonical URL matching `NEXT_PUBLIC_SITE_URL`
- Open Graph URL/image on the production host
- Twitter card metadata
- favicon and manifest references

## Do Not

- Do not commit real secrets.
- Do not use `NEXT_PUBLIC_*` for private keys.
- Do not hardcode localhost in production metadata.
- Do not change the deployment root or build output without validating `packages/web/dist`.
- Do not use automated audit-fix commands without review.
