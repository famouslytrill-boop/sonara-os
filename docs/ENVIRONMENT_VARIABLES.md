# Environment Variables

Real values belong in Vercel, Supabase, Stripe, Resend, GitHub Actions secrets, local `.env`, or a password manager. Do not commit real secrets.

## Public Client-Safe

These may be exposed to the browser because they are prefixed with `NEXT_PUBLIC_` and are not secrets:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPPORT_CONTACT_LABEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Never place service-role keys, webhook secrets, database URLs, API keys, tokens, payout details, or private provider credentials in any `NEXT_PUBLIC_*` variable.

## Server-Only

Configure these only in server-side hosting environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `SMTP_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `SONARA_CRON_SECRET`
- `SONARA_ADMIN_EMAILS`
- `OPENCLAW_GATEWAY_TOKEN`
- `N8N_API_KEY`
- `LANGFLOW_API_KEY`
- `DIFY_API_KEY`
- `OPEN_WEBUI_API_KEY`
- `RAGFLOW_API_KEY`
- `CREWAI_WORKER_TOKEN`
- `N8N_ENCRYPTION_KEY`
- `LANGFLOW_SUPERUSER_PASSWORD`
- `LANGFLOW_SECRET_KEY`
- `OPEN_WEBUI_SECRET_KEY`

`SONARA_ADMIN_EMAILS` is a comma-separated list used server-side to grant first-owner/admin bootstrap during authenticated workspace setup. Do not hardcode owner emails in client code.

## Optional Provider Variables

- Stripe prices: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_SETUP_99`, `STRIPE_PRICE_SETUP_299`, `STRIPE_PRICE_SETUP_499`
- Support recipients: `SUPPORT_EMAIL`, `CONTACT_EMAIL`, `HELP_EMAIL`, `BILLING_EMAIL`, `SECURITY_EMAIL`, `PRIVACY_EMAIL`, `LEGAL_EMAIL`
- Resend sender: `RESEND_FROM_EMAIL`
- SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`

### Governed AI service adapters

Each adapter requires an explicit `*_ENABLED=true` flag and is otherwise inert. The configured URL and credential stay on the server. `SONARA_AI_INTEGRATION_PROBE_TIMEOUT_MS` controls the bounded admin readiness probe and is clamped between 250 and 5,000 milliseconds.

| Adapter | Enable flag | Base URL | Credential |
| --- | --- | --- | --- |
| OpenClaw | `OPENCLAW_ENABLED` | `OPENCLAW_BASE_URL` | `OPENCLAW_GATEWAY_TOKEN` |
| n8n | `N8N_ENABLED` | `N8N_BASE_URL` | `N8N_API_KEY` |
| Ollama | `OLLAMA_ENABLED` | `OLLAMA_BASE_URL` | None; keep the service private |
| Langflow | `LANGFLOW_ENABLED` | `LANGFLOW_BASE_URL` | `LANGFLOW_API_KEY` |
| Dify | `DIFY_ENABLED` | `DIFY_BASE_URL` | `DIFY_API_KEY` |
| Open WebUI | `OPEN_WEBUI_ENABLED` | `OPEN_WEBUI_BASE_URL` | `OPEN_WEBUI_API_KEY` |
| RAGFlow | `RAGFLOW_ENABLED` | `RAGFLOW_BASE_URL` | `RAGFLOW_API_KEY` |
| CrewAI worker | `CREWAI_ENABLED` | `CREWAI_WORKER_URL` | `CREWAI_WORKER_TOKEN` |

LangChain is a worker-framework reference, DeepSeek V3 is an optional model family served through an approved gateway, and Gemini CLI and Claude Code are development tools. They intentionally have no production enable flags.

Google OAuth client credentials are configured in Supabase provider settings, not in this repository. Phone OTP requires Supabase Phone provider and SMS provider setup.

Language and unit-system preferences do not require provider env vars; signed-in users persist them in the `user_preferences` table.

## Vercel Setup

Set production and preview variables in the Vercel project dashboard. After changing auth, Supabase, Stripe, or email variables, redeploy with build cache disabled if the previous deployment used stale configuration.

## Local Setup

Use `.env.local` for local development. Do not commit it. Keep `.env.example` as placeholders only.

## Validation

Run:

```powershell
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run verify:env
pnpm run verify:stripe
```

Validation must report configured/not configured states without printing raw secret values.
