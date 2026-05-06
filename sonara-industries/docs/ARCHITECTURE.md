# SONARA Industries Architecture

SONARA Industries owns three separate operating companies: SONARA One, TableOps Systems, and CivicSignal Network.

The shared spines are security, billing, infrastructure, audit logging, deployment, and parent governance. Product surfaces, dashboards, onboarding, themes, customer data, and workflows remain separated by app scope.

## Subdomain Strategy

- sonaraindustries.com -> parent company website
- music.sonaraindustries.com -> SONARA One
- tableops.sonaraindustries.com -> TableOps Systems
- civic.sonaraindustries.com -> CivicSignal Network
- admin.sonaraindustries.com -> parent admin console
- api.sonaraindustries.com -> shared API gateway
- docs.sonaraindustries.com -> help/docs
- status.sonaraindustries.com -> status placeholder

Local development uses path-based routes for the same surfaces.

