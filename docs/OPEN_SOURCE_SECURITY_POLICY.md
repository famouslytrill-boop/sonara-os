# Open-Source Security Policy

Status: launch policy draft.

## High-Risk Categories

- Scraping tools
- Unofficial messaging automation
- Browser agents
- VPN and remote desktop tools
- Voice, visual, image, video, and music generation tools
- Local model runtimes and model downloaders
- Unknown projects

## Defaults

- `AUTO_INSTALL_EXTERNAL_REPOS=false`
- `RISKY_SCRAPING_TOOLS_ENABLED=false`
- `UNOFFICIAL_MESSAGING_AUTOMATION_ENABLED=false`
- Media generation candidates stay beta-gated.
- Unknown projects stay `not_reviewed`.

## Required Security Review

Security review must check:

- Credential handling
- Scraping/provider terms risk
- Customer data exposure
- Secret or token storage
- Network access
- File system access
- Dependency health
- Abuse potential
- Owner Confirmation Lock coverage for risky actions

## Production Rule

No candidate can become a production dependency, hosted service, or user-facing feature until the
security review is complete and the integration decision is audit logged.
