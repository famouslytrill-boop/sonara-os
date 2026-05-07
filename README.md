# SONARA Industries

SONARA Industries is a technology holding company that owns independent software companies.

Tagline: Independent systems. Shared infrastructure. Stronger markets.

## House Of Brands

SONARA Industries owns the standards, security model, research layer, approval architecture, billing posture, and operating infrastructure. The child companies stand independently:

- TrackFoundry: music creation and release-readiness software. Build the artist. Shape the release.
- LineReady: restaurant operations and labor-control software. Every shift ready.
- NoticeGrid: verified local information and public-notice software. Local updates without the noise.

The parent company should not make every product look like SONARA. Each product has its own audience, interface tone, pricing, modules, app shell, and resources.

## Shared Operating Intelligence Layer

The MVP foundation includes typed placeholders and schema support for:

- organization scope and brand scope
- approval queues for risky actions
- audit logs
- secure external link handling
- content quality, page quality, and SEO usefulness scoring
- workflow bottleneck and forecast confidence scoring
- role-safe recommendations
- human approval checkpoints
- observability readiness

AI-provider keys are optional. The system must run without OpenAI, Anthropic, or Gemini keys.

## Safety Rules

AI can draft, summarize, classify, recommend, score, and prepare.

AI cannot auto-publish public notices, send mass notifications, delete users, change billing, escalate roles, activate public QR codes, approve public-facing claims, or execute other risky actions without human approval.

Do not launch paid customers until real auth, RLS, Stripe price IDs, Stripe webhooks, production environment variables, upload boundaries, and mobile/desktop QA are verified.

NoticeGrid is not a government authority, voting system, emergency dispatch system, medical alert system, or law-enforcement system.

LineReady is not a payroll provider, POS processor, bank, insurer, or regulated payment processor.

TrackFoundry supports influence DNA only. Do not copy real artists or imitate copyrighted material.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- FastAPI
- Pydantic
- PostgreSQL-ready schema
- Supabase-ready auth/RLS structure
- Stripe placeholders
- PWA manifest/service worker
- GitHub Actions dependency/security workflow

Optional open-source-first infrastructure:

- Supabase or self-hosted Postgres
- MinIO or S3-compatible object storage
- Coolify deployment option
- Dokku deployment option
- Docker Compose local infrastructure later
- OpenTelemetry-ready logs, metrics, and traces
- Vercel deployment option

## Routes

Parent routes:

- `/`
- `/websites`
- `/pricing`
- `/security`
- `/research`
- `/trust`
- `/support`
- `/tutorial`
- `/store`
- `/founder`
- `/privacy`
- `/terms`

Product routes:

- `/trackfoundry`
- `/trackfoundry/features`
- `/trackfoundry/how-it-works`
- `/trackfoundry/app`
- `/trackfoundry/pricing`
- `/trackfoundry/security`
- `/trackfoundry/resources`
- `/lineready`
- `/lineready/features`
- `/lineready/how-it-works`
- `/lineready/app`
- `/lineready/pricing`
- `/lineready/security`
- `/lineready/resources`
- `/noticegrid`
- `/noticegrid/features`
- `/noticegrid/how-it-works`
- `/noticegrid/app`
- `/noticegrid/pricing`
- `/noticegrid/security`
- `/noticegrid/resources`

Redirects:

- `/music` to `/trackfoundry`
- `/tableops` to `/lineready`
- `/alertos` to `/noticegrid`
- `/civicsignal` to `/noticegrid`

## Local Verification

PowerShell:

```powershell
cd frontend
npm install
npm run typecheck
npm run lint
npm run build
cd ..
python -m py_compile backend/main.py
```

Bash, when available:

```bash
bash scripts/verify.sh
```

On Windows with Git Bash:

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/verify.sh
```

## Environment

Use `.env.example` as the source of truth. Keep secret keys server-side. Do not commit `.env.local`.

Important optional services:

- Supabase/Postgres for auth, schema, storage, and RLS
- Stripe for paid tiers after price IDs and webhooks are verified
- S3-compatible storage or MinIO for uploads
- OpenTelemetry endpoint for observability
- Coolify or Dokku for open-source self-hosting experiments

## Database

Schema lives in `infra/db/sonara_house_of_brands.sql`.

The schema prepares shared platform tables, TrackFoundry tables, LineReady tables, NoticeGrid tables, dynamic page publishing, approval queues, audit logs, uploaded assets, operating metrics, integration placeholders, and recommendation records.

RLS policy comments are included, but production RLS is not complete until applied and tested in Supabase/Postgres.
