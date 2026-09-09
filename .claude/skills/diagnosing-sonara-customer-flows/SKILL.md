---
name: diagnosing-sonara-customer-flows
description: Trace a failing SONARA customer journey through authorization, persistence, and provider response. Use for failed signup, organization setup, checkout, support submissions, or product-record saves.
---

# Diagnose a customer flow

Start with the failing route, expected outcome, and sanitized reference ID.
Read `.ai/shared/` and Git history before editing. Trace the production Express
handler; a frontend workspace is not proof of the deployed handler.

Build an evidence chain: validation, session, organization membership,
entitlement, database operation, provider operation, and rendered response.
Label each observed, mocked, unavailable, or not applicable. A configured key
is not delivery proof; a checkout redirect is not subscription proof.

Reproduce with existing Mocha/Supertest fixtures and provider doubles. Test
unauthorized access, cross-organization rejection, persistence, and provider
failure after persistence. Preserve saved requests when email fails. Never
clear sessions as a diagnostic workaround.

Patch the smallest failing boundary. Keep secrets out of fixtures and output.
Do not make production writes or send messages without explicit authorization.
Stop retries after the tested attempt; report sanitized failure evidence.

Run focused regressions, then the root launch gate. Report command results,
mock-versus-live boundaries, provider setup, and rollback. Update the shared
handoff with file references and a reproducible next step.

This is an original repository-local skill, not a customer automation or a
global assistant installation.
