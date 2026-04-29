# SONARA Launch Readiness

Status: local launch package ready. Production gates were attempted on 2026-04-27; see `docs/PRODUCTION_GATE_RESULTS.md`.

## Green Checks

- Next.js production build passes.
- TypeScript passes.
- npm audit passes with 0 moderate-or-higher vulnerabilities.
- Backend tests pass.
- Visible navigation is limited to Home, Create, Library, Export, Settings.
- SONARA Core analysis API is present at `/api/sonara/analyze`.
- SONARA Core defaults to Local Rules and does not require `OPENAI_API_KEY`.
- OpenAI is optional BYOK mode, not a production launch requirement.
- Release-kit ZIP export API is present at `/api/sonara/export`.
- Export Bundle includes Song Fingerprint, Sound Discovery, Streaming Pack, Broadcast Kit, and Breath Control assets.
- Launch package excludes `.env.local`, `node_modules`, `.next`, virtualenvs, caches, and logs.

## Product Boundary

SONARA remains a music identity and release-readiness system:

- Every song gets a fingerprint.
- Every release gets a plan.
- Every creator gets a cleaner path from idea to launch.

SONARA is not a generic music generator, distributor, streaming platform, OBS clone, video editor clone, raw analytics clone, or cluttered dashboard.

## Production Gates

- Run one Local Rules structured-output route test with non-sensitive sample data.
- Optional: run one OpenAI Structured Outputs test only when `SONARA_AI_PROVIDER=openai` and BYOK credentials are available.
- Apply `infra/supabase/sonara_launch_schema.sql` in Supabase.
- Set production environment variables in the host.
- Verify private Supabase storage policies in production.
- Deploy to the production host and run route smoke tests there.
