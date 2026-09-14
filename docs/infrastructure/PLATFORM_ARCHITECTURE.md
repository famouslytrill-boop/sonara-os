# Platform Architecture

SONARA is multi-tenant first. Public product routes are separate from private app routes. Sensitive actions require audit events, RLS, provider setup, and human review.

The canonical engineering/security/agent stack is defined in `docs/architecture/SONARA-ENGINEERING-SECURITY-AGENT-ARCHITECTURE.md`.

## Engineering Intelligence

`repository analysis -> Archify System Map -> architecture-delta review -> automated tests -> security gates -> deployment`

Archify is development/CI tooling only and must not sit on the production customer request path.

## Security

`SAST/dependency/secret scanning -> RLS and tenant-isolation tests -> adversarial application tests -> BreachLab-derived training/playbooks -> release security evidence`

BreachLab is an external training/reference source, not a production dependency. Security testing is limited to SONARA-owned systems or explicitly authorized environments.

## Experience / Agents

`current text/voice agent -> skills/tool permissions -> memory -> emotion/state system -> optional three.ws 3D presentation adapter`

The three.ws integration is optional, isolated behind an adapter boundary and feature flag, and may not grant additional permissions or become a dependency for authentication, billing, database, admin, text, or voice functionality.
