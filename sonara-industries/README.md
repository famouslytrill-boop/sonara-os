# SONARA Industries Operating Systems

A production-ready starter monorepo for SONARA Industries, the parent company for three separate operating companies and software systems.

## Operating Companies

- SONARA One: music identity, artist development, creative catalog, prompt export, and release-readiness.
- TableOps Systems: restaurant operations, recipe R&D, costing, prep, training, QR menu, SOP, and inventory signals.
- CivicSignal Network: public access, local information, RSS, transit feeds, civic announcements, community broadcast, alerts, and public documents.

The apps are deliberately separate. Customer data, dashboards, analytics, onboarding, pricing, permissions, and workflows stay separated unless explicitly authorized by the user and parent admin policy.

## Local Development

1. Install pnpm.
2. Install Python 3.12+.
3. Copy .env.example to .env.
4. Run docker compose up -d postgres redis.
5. Run pnpm install.
6. From apps/api, install dependencies and run Alembic migrations.
7. Start the API: uvicorn app.main:app --reload.
8. Start the web app: pnpm --filter @sonara-industries/web dev.
9. Open http://localhost:3000.
10. Test http://localhost:8000/health.

## Security Notes

Do not commit secrets. Do not expose Postgres directly to the public internet. CivicSignal is a public information aggregator unless verified by a public partner.

