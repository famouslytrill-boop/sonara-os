# ADR-0001: Production runtime is the root Express app
Status: ACCEPTED (evidence-based, 2026-07-18)
Decision: Production is server.js exported via api/index.js on Vercel with a
catch-all rewrite to /api. Verified live: /api/health returns the deployed
commit; Vercel deployment metadata confirms build from repo root.
The nested frontend/, my-app/, app/, sonara-industries/ trees are experiments,
excluded from lint/build, and MUST NOT be deployed without a parity ADR.
Consequences: frontend work happens in layout()/public assets; backend work in
server.js/routes/lib; framework migration requires a new ADR + parity plan.
