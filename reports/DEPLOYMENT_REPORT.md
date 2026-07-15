# SONARA Deployment Report

Date: 2026-07-14

## Production path (unchanged)

- Vercel, root Express deployment: `vercel.json` rewrites `/(.*)` →
  `/api`; `api/index.js` exports the Express app; `functions."api/index.js"
  .includeFiles` is the string glob `{public/**,routes/**,lib/**}`
  (validated by test); build runs `npm run vercel-build`
  (apply:runtime codemods + `node --check server.js`).
- Domain: https://sonaraindustries.com. Deploys trigger on push to
  `github/main`.
- `express.static` resolves from `__dirname`, so assets serve identically
  under Vercel, Docker, or any working directory.

## Container path (new, operator/staging only)

- `Dockerfile`: node:20-alpine, production deps only, runtime codemods
  baked at build, non-root `node` user, `HEALTHCHECK` on `/api/health`,
  `PORT` env (default 3000), no secrets in the image.
- `.dockerignore`: excludes `.env*` (except example), node_modules, git,
  legacy app trees, tests/reports — secrets cannot bake in.
- `docker-compose.dev.yml`: port 5000, `.env` file, 512M limit,
  `restart: unless-stopped`.
- Rancher notes: `docs/infrastructure/DOCKER_RANCHER.md` (probes, secrets
  as env, stateless scaling, no volumes). Vercel remains the production
  web path; Rancher is not in front of production traffic.

## PWA / caching

- `site.webmanifest` + full icon set served and tested; standalone display
  and theme colors configured.
- Service worker v2: cache name bound to `interface-dom-20260714`; old
  caches purged on activate; navigations network-first with `/offline`
  fallback; same-origin static assets stale-while-revalidate. Bump the
  version token in `server.js` head links and `sw.js` together (kept in
  sync this release).

## Verification before this release

```
npm run build               OK
npm test                    240 passing
npm run scan:client-secrets PASSED
npm run lint                0 problems
npm run verify:launch       exit 0
git diff --check            clean
```

Deployment URL and commit SHA are recorded in FINAL_REPORT.md at ship time.
