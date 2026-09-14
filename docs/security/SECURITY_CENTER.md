# Security Center

Security foundations include role-based access, organization permissions, RLS, webhook verification, file validation, audit logs, no service-role keys in the frontend, and no raw card/CVV/bank credential storage.

The canonical security pipeline is:

`SAST/dependency/secret scanning -> RLS and tenant-isolation tests -> adversarial application tests -> BreachLab-derived training/playbooks -> release security evidence`

## Required security domains

- static analysis and unsafe-code detection;
- dependency and supply-chain risk review;
- secret detection and environment-safety checks;
- authentication, session, and authorization tests;
- RLS and cross-tenant denial tests;
- webhook signature and replay defenses;
- file-upload validation;
- API abuse, injection, XSS, SSRF, and privilege-escalation testing where applicable;
- agent/tool permission-boundary tests for AI-assisted workflows;
- release evidence retained with production changes.

BreachLab is used only as an external training/reference source for authorized SONARA testing and internal playbook development. It is not a runtime dependency.

See `docs/security/LAUNCH_SECURITY_GATE.md` and `docs/architecture/SONARA-ENGINEERING-SECURITY-AGENT-ARCHITECTURE.md` for release enforcement and architecture boundaries.
