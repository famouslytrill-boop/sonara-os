# Trust Shield

## Problem

The platform needs a central safety layer that blocks unsafe claims, fake proof, payment risks, privacy risks, and unsafe automation before launch.

## Users

- Owners
- Admin reviewers
- Developers

## User Stories

- As a reviewer, I can see blocked risk categories.
- As a developer, I can check safety requirements before implementation.
- As an owner, I can understand why a risky action is not available.

## Non-Goals

- No punitive worker scoring.
- No hidden surveillance.
- No automatic high-risk remediation.

## Data Model Notes

- Track risk category, severity, message, blocked action, reviewer, and timestamps when persistence exists.
- Keep safe static defaults before persistence.
- Link future events to audit logs.

## Route Requirements

- Internal or admin route for safety review.
- Public UI should use plain safety language.
- No public exposure of internal risk internals by default.

## API Requirements

- Provide deterministic risk checks.
- Never bypass provider or payment policy gates.
- No automatic changes to payment, security, or permissions.

## Security Requirements

- Block unsafe automation categories.
- Keep service-role secrets server-only.
- Require human review for high-risk changes.

## Privacy Requirements

- Do not log private customer data in risk records.
- Do not expose private records publicly.
- Avoid sensitive attribute targeting.

## Acceptance Criteria

- Unsafe categories return blocked status.
- Safe checks are deterministic.
- High-risk actions require human review.

## Test Requirements

- Test representative blocked categories.
- Test service-role public leak detection.
- Test no unsafe flags are enabled.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Security review completed before launch.
