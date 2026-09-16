# Hosted model providers: OpenAI / ChatGPT and Anthropic Claude

Status: optional, server-side, explicit-use drafting adapters.

This document is authoritative for direct OpenAI and Anthropic configuration on branches that contain `lib/sonara-openai-provider.cjs` and `lib/sonara-anthropic-provider.cjs`. It supersedes the older statement in `INSTALL-ALL-KEYS.md` that `OPENAI_API_KEY` is unused. That statement described the repository before these adapters existed.

## What is installed

SONARA now has two direct hosted text-provider adapters:

- **OpenAI / ChatGPT** through the OpenAI Responses API.
- **Anthropic Claude** through the Anthropic Messages API.

They are used by the founder/admin business drafting surface at:

`/admin/ai-integrations/business-draft`

The route is deliberately narrow. It creates reviewable text drafts. It does **not** send email, publish content, change billing, alter customer records, approve an action, or perform work on a third-party account.

The request still passes through `lib/sonara-agent-runner.cjs` using the existing `draft_content` authority class. Consequential actions remain behind their existing owner-approval rules.

## Default behavior

The default remains deterministic SONARA logic:

```env
SONARA_AI_PROVIDER=local_rules
SONARA_PROVIDER_TIMEOUT_MS=6000
```

A hosted provider is never selected as a silent fallback. Choosing OpenAI does not fall back to Anthropic, and choosing Anthropic does not fall back to OpenAI. That keeps provider, cost, and data-processing decisions explicit.

## OpenAI / ChatGPT

Configure these as server-side Vercel environment variables:

```env
OPENAI_API_KEY=<your server-side OpenAI API key>
SONARA_OPENAI_MODEL=gpt-5.6-luna
```

`OPENAI_API_KEY` is a secret. Mark it Sensitive in Vercel. Never create a `NEXT_PUBLIC_OPENAI_API_KEY` and never paste the value into source control, documentation, issues, pull requests, or chat.

The adapter sends the credential only to the fixed official OpenAI API host. There is no environment-controlled base URL for this credential. Requests set `store: false`, use a bounded timeout, and limit output size.

## Anthropic Claude

Configure these as server-side Vercel environment variables:

```env
ANTHROPIC_API_KEY=<your server-side Anthropic API key>
SONARA_ANTHROPIC_MODEL=claude-sonnet-5
```

`ANTHROPIC_API_KEY` is a secret. Mark it Sensitive in Vercel. Never create a `NEXT_PUBLIC_ANTHROPIC_API_KEY` and never paste the value into source control, documentation, issues, pull requests, or chat.

The adapter sends the credential only to the fixed official Anthropic API host and uses the Messages API contract. System/developer instructions are placed in Anthropic's top-level system field; user/assistant turns remain in the message list.

## Data boundary

The first shipped surface intentionally does **not** fetch customer records for a model prompt. The only business content sent to a hosted provider is the text an authenticated founder/admin explicitly enters into the drafting form.

Do not paste passwords, API keys, private keys, access tokens, payment-card data, or other credentials into the drafting prompt.

If a future feature uses organization records, it must add all of the following before release:

- explicit product and tenant scope;
- a documented lawful/contractual data-processing basis;
- minimum-necessary field selection and redaction;
- a visible provider choice or organization policy;
- usage/cost accounting where the capability is customer-billable;
- audit evidence that does not log prompt secrets;
- the same owner-approval boundaries used by the rest of SONARA.

## Readiness and verification

The admin integration page reports only non-secret readiness. A configured state means the expected server-side credential and model configuration are present; it does not display credential values.

After setting a provider variable in Vercel, redeploy the application, then verify:

1. `/api/admin/ai-integrations/readiness` reports the selected provider as configured.
2. `/admin/ai-integrations/business-draft` enables that provider in the selector.
3. Generate a harmless test draft.
4. Confirm the result is labelled as a draft and nothing was sent or published.
5. Confirm application/audit logs contain provider/status metadata but not the prompt or API key.

Do not describe either provider as live merely because its code exists. It is live only after the secret is configured in the deployed environment and a bounded request succeeds.

## What this does not install

This does not install or authorize an end-user ChatGPT subscription, Claude subscription, Claude Code account, or ChatGPT plugin. Direct application calls use provider API credentials owned/configured for the SONARA deployment.

Claude Code and ChatGPT/Codex repository instructions remain development workflows governed by `CLAUDE.md`, `AGENTS.md`, and `.ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md`; those files do not grant production provider authority.
