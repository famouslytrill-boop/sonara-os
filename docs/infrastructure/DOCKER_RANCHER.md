# SONARA Docker and Rancher Notes

Docker and Rancher are operator infrastructure layers. Production web traffic
stays on the Vercel Express deployment; nothing here changes that
architecture. Use these images for self-hosted staging, operator tooling, or
a deliberate future migration only.

## Image

- `Dockerfile` — node:20-alpine, production deps only, runtime codemods baked
  at build (same chain as `vercel-build`), non-root `node` user,
  `HEALTHCHECK` against `/api/health`, port from `PORT` (default 3000).
- `.dockerignore` keeps `.env*`, `node_modules`, git history, legacy app
  trees, and reports out of the build context — no secrets can bake in.

Build and run:

```bash
docker build -t sonara-os .
docker run --rm -p 3000:3000 --env-file .env sonara-os
```

## Development compose

`docker-compose.dev.yml` runs the same image on port 5000 with a 512M memory
limit and `restart: unless-stopped`. Values come from a local `.env` file
that is never committed.

## Rancher deployment notes

1. Push the image to a private registry; reference it from a Rancher
   Deployment with 1+ replicas.
2. Configuration via Rancher secrets/config maps mapped to the same env
   names as `.env.example`. Never bake values into the image.
3. Liveness/readiness probes: HTTP GET `/api/health` (returns 200 with
   non-secret metadata).
4. Resource requests/limits: start at 128Mi request / 512Mi limit; the app
   is a single stateless Express process.
5. Persistence: the app is stateless — all state lives in Supabase/Stripe.
   No volumes are required; do not mount secrets as files.
6. Logging: stdout/stderr only; collect with the cluster's log stack. The
   app never prints secret values.
7. Scaling: horizontal replicas are safe; sessions are cookie+Supabase
   token based, no sticky sessions needed.
8. Workers: none required for the Express MVP (no background queues yet).
