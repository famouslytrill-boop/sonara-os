# Optional AI Gateway (OmniRoute)

Status: optional, operator/development only. The public SONARA site and all
customer workflows run fully without it.

## What it is

[OmniRoute](https://github.com/diegosouzapw/OmniRoute) is an open-source local
AI gateway that can route requests across AI providers. SONARA treats it as an
**optional developer/operator tool** for local experimentation.

## What SONARA does and does not do

- SONARA ships a readiness detector only: `lib/optional-ai-gateway.cjs`.
- The admin console shows gateway state at `/admin/ai-gateway` (founder access
  required). Key values are never displayed.
- SONARA does **not** bundle, install, or depend on OmniRoute source code.
- No public route calls the gateway. No customer data is ever routed to it.

## Environment names

Set in local `.env` only (never commit values):

| Variable | Purpose |
| --- | --- |
| `SONARA_AI_GATEWAY_URL` or `OMNIROUTE_BASE_URL` | Base URL of the local gateway |
| `SONARA_AI_GATEWAY_KEY` or `OMNIROUTE_API_KEY` | Optional API key for the gateway |

Leave all four empty for normal operation. The readiness detector reports
`not_configured` and everything else works unchanged.

## Safety rules

1. Never route customer data through a local AI gateway.
2. Never expose gateway keys to the browser or commit them to the repository.
3. Keep the gateway off in production unless owner-approved.
4. Before running OmniRoute locally, inspect its license, package scripts, and
   dependency tree like any other external repository. Do not run unknown
   install scripts.

## Verification

- `GET /admin/ai-gateway` (founder session) shows status without secrets.
- With no env vars set, status is `Not configured` and the platform is
  unaffected.
