# SONARA Ops Python Layer

This package is for local, CI, and trusted operations workflows around the SONARA OS database and platform infrastructure.

It is not a long-running Python server inside the Vercel Next.js app. Production runtime remains Next.js + Vercel + Stripe + Supabase/PostgreSQL.

## Setup

```powershell
cd python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```

Fill only local/private values in `python/.env`. Never commit real secrets.

## Commands

```powershell
python -m sonara_ops.main health
python -m sonara_ops.main schema-report
python -m sonara_ops.main stripe-audit
python -m sonara_ops.main jobs-list
```

Health checks are safe to run without credentials. When `SUPABASE_DB_URL` is missing, the command reports setup-required instead of failing with secret output.
