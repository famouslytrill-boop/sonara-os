# ADR-0006: External Integrations

Status: Accepted

## Decision

Adopt integrations through registry, license/security/privacy review, feature flag, adapter, tests, and owner approval. References such as HyperFrames, optional AI systems, GitLab, Expo, Docker, and Rancher are not production dependencies unless separately approved.

## Consequences

- No auto-install or copied third-party source.
- Unknown/restricted licenses remain blocked or review-only.
- Provider setup is never inferred from plugin availability.

