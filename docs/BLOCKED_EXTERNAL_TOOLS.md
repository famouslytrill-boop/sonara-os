# Blocked External Tools

Status: enforced by intake registry.

Blocked means the project must not be installed, copied, vendored, self-hosted, or exposed to users
for production use.

## Currently Blocked

- `zohaibbashir/Google-Maps-Scrapper`
  - Reason: direct Google scraping is blocked.
  - Use official APIs, OpenStreetMap, public datasets, or customer-provided data instead.
- `rmyndharis/OpenWA`
  - Reason: unofficial WhatsApp automation is blocked.
  - Use official WhatsApp Business API or approved providers only.

## Blocked Classes

- Provider-terms scraping tools
- Credential automation tools
- Phishing or impersonation tooling
- Unofficial customer messaging automation
- Tools that bypass consent, opt-out, or owner approval requirements

## Override Rule

Blocked tools require a new owner/legal/security decision before any status change. The default
answer is no production use.
