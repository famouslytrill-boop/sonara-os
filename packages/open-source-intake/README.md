# Open-Source Intake Registry

The Open-Source Intake Registry records external GitHub and open-source projects as review
candidates. It does not copy external source code, install candidate projects, vendor third-party
packages, or mark integrations as live.

## Rules

- Strip tracking parameters from stored URLs.
- Treat GPL and AGPL projects as license-review required.
- Block scraping and unofficial messaging automation by default.
- Keep voice, visual, music, browser automation, VPN, and remote desktop tools behind security review
  or beta gates.
- Do not claim a project is integrated unless a reviewed adapter or isolated service is actually
  configured.

## Feature Flags

- `OPEN_SOURCE_INTAKE_ENABLED=true`
- `AUTO_INSTALL_EXTERNAL_REPOS=false`
- `GPL_CODE_COPY_ALLOWED=false`
- `AGPL_CODE_COPY_ALLOWED=false`
- `RISKY_SCRAPING_TOOLS_ENABLED=false`
- `UNOFFICIAL_MESSAGING_AUTOMATION_ENABLED=false`

## Review Outcomes

The registry supports reference-only use, concept adapters, optional provider adapters, isolated
self-hosting after review, internal admin tools, beta-gated features, legal/security review, and
blocked projects. Unknown projects stay `not_reviewed`.
