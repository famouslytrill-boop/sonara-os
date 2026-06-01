# External Repo Policy

External projects are intake candidates until reviewed. They are not dependencies, integrations, partnerships, or product features by default.

## Required Review

Before copying, installing, vendoring, self-hosting, or exposing external code:

- License review.
- Security review.
- Product-fit review.
- Owner approval.
- Integration decision record.

## Blocked By Default

- GPL/AGPL code copied into proprietary app packages.
- Risky scraping tools.
- Unofficial messaging automation.
- Credential automation.
- VPN or remote-desktop tooling exposed to customers.
- Media-generation tools without consent, rights, and owner approval gates.

## URL Hygiene

Stored URLs must remove tracking parameters such as `fbclid`, `utm_source`, `utm_medium`, `utm_campaign`, and similar campaign identifiers.
