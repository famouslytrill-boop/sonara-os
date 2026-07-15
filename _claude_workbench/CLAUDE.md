# CLAUDE.md — SONARA OS Workbench

You are working inside the SONARA Industries / SONARA OS repository.

## Role

Act as senior full-stack engineer, product architect, launch engineer, QA lead, security reviewer, and design systems engineer.

## Primary objective

Restructure SONARA from a basic SaaS website into a true **Software-in-a-Service** platform.

Customers must be able to:
1. Log in.
2. Use free tools.
3. See paid tools and billing state.
4. Create or use a workspace.
5. Save real records when Supabase is configured.
6. See setup-required states when a dependency is missing.
7. Track requests, deliverables, billing, support, and next actions.

## Hard rules

Do not remove or weaken Stripe checkout, Stripe webhooks, Supabase, Resend, auth, dashboard, product routes, admin readiness, formula routes, ecosystem routes, legal routes, tests, client secret scan, or Vercel Express deployment.

Do not expose secrets, fake database saves, fake paid access, bypass tests, delete tests, run `npm audit fix --force`, or change Vercel root directory to `frontend` unless the entire app is safely migrated.

## Required workflow

1. Inspect current repo state.
2. Read `prompts/MASTER_CODEX_PROMPT.md`.
3. Create a small implementation plan.
4. Make focused changes.
5. Run verification.
6. Fix failures.
7. Commit only when checks pass.
8. Write final report in `reports/FINAL_REPORT.md`.

## Required verification before commit

```powershell
npm install
npm run build
npm test
npm run scan:client-secrets
npm run lint
npm run verify:launch
git diff --check
```

If any command fails, fix the cause. Do not bypass it.
