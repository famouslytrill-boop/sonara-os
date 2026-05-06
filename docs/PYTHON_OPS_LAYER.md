# Python Ops Layer

The `python/` folder contains local and CI operations tooling for SONARA OS.

Python is not embedded as a long-running server inside the Vercel Next.js app. Production runtime remains:

```text
Next.js + Vercel + Stripe + Supabase/PostgreSQL
```

## Use Cases

- database health checks
- migration verification
- schema reports
- Stripe wiring audits
- analytics exports
- platform job inspection

## Setup

```powershell
cd python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```

Fill in local values in `python/.env`. Do not commit real secrets.

## Environment Variables

- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `STRIPE_SECRET_KEY` optional

The tools should never print secret values.

## Commands

```powershell
python -m sonara_ops.main health
python -m sonara_ops.main schema-report
python -m sonara_ops.main stripe-audit
python -m sonara_ops.main jobs-list
```

From the repo root:

```powershell
npm run python:health
```

If credentials are missing, the health command reports setup-required style warnings rather than crashing or exposing secrets.
