# Launch Security Gate

Do not launch until typecheck, build, audit, route smoke, legacy, public-claims, env-safety, license, provider, database, and GitHub Radar safety checks pass.

For material production changes, the release gate also requires the security evidence appropriate to the changed surface:

- SAST/static-analysis result;
- dependency-risk audit;
- secret scan;
- RLS and tenant-isolation verification when data/auth boundaries change;
- adversarial application tests when exposed attack surfaces change;
- route/auth/session smoke coverage;
- architecture-delta review for material topology, permission, provider, schema, or trust-boundary changes;
- documented known-risk/exception record for any accepted residual risk;
- release approver and deployment reference.

High-risk unresolved authorization, tenant-isolation, secret-exposure, or privilege-escalation findings are release blockers.

BreachLab-derived material may be used to build internal training and authorized test playbooks, but BreachLab is not a production dependency and must not be used to test third-party systems without authorization.

See `docs/architecture/SONARA-ENGINEERING-SECURITY-AGENT-ARCHITECTURE.md` for the canonical engineering/security flow.
