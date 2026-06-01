# Open-Source Intake Registry

Status: admin-gated registry and review plan.

The Open-Source Intake Registry tracks external GitHub/open-source projects before any code is
copied, installed, vendored, self-hosted, or exposed to users.

## What Exists

- Package: `packages/open-source-intake`
- Admin route: `/admin/open-source-intake`
- Review route: `/admin/open-source-intake/reviews`
- Blocked route: `/admin/open-source-intake/blocked`
- Security route: `/security-center/open-source-risk`
- Migration plan: `infra/db/migrations/open_source_intake_registry.sql`

## Review Fields

- Repository owner/name and normalized URL
- Category
- Product fit
- Use mode
- License risk
- Security risk
- Integration status
- Rules and review notes
- Audit events

## Safety Rules

- Do not copy external source code until license review explicitly allows it.
- Do not vendor GPL or AGPL code into proprietary app packages.
- Do not install scraping, phishing, credential, VPN, automation, or media-generation tools as
  production dependencies without owner/legal/security approval.
- Do not create fake integrations.
- Do not claim a project is connected unless actual configuration exists.
- Strip `fbclid`, `utm_*`, and other tracking parameters from stored URLs.

## Current Candidate Count

The registry contains 35 owner-provided projects. They are intake candidates, not dependencies.

## Required Before Integration

1. Legal review of license and branding obligations.
2. Security review of runtime, data, credential, privacy, and abuse risk.
3. Product-fit review against SONARA One launch scope.
4. Owner approval for any adapter, self-hosted service, beta feature, or public exposure.
5. Audit-log entry for the decision.
