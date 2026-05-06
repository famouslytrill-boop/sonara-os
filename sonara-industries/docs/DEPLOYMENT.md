# Deployment

Local development:

1. Install pnpm.
2. Copy .env.example to .env.
3. Run docker compose up -d postgres redis.
4. Install web dependencies with pnpm install.
5. Install API dependencies in apps/api.
6. Run Alembic migrations.
7. Start API and web dev servers.

Production options:

- Vercel or Cloudflare Pages for the frontend.
- Managed PostgreSQL with backups.
- Managed Redis for queues/cache.
- Object storage for uploads.
- API on a container host or serverless container platform.

Cloud services can have free tiers, but production hosting is not assumed to be free forever.

