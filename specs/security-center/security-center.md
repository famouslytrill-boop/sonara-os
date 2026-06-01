# Security Center

## Problem

Owners and reviewers need a clear view of security setup without overstating enterprise security or hiding unresolved configuration requirements.

## Users

- Owners
- Admin reviewers
- Developers

## User Stories

- As an owner, I can see setup requirements.
- As a reviewer, I can confirm secrets are not exposed.
- As a developer, I can validate security gates before release.

## Non-Goals

- No certified security claims.
- No automatic permission changes.
- No public stack traces.

## Data Model Notes

- Track checklist item, status, owner, reviewer, and timestamps when persistence exists.
- Keep static checklist state honest until real checks exist.
- Link future security events to audit logs.

## Route Requirements

- Owner/admin security checklist route.
- Clear setup-mode state when checks are not wired.
- No customer-private details in public UI.

## API Requirements

- Security checks must be read-only unless reviewed.
- Do not expose secrets through status endpoints.
- Future write actions require explicit review.

## Security Requirements

- Detect service-role public leaks.
- Avoid public debug cases and stack traces.
- Require review for auth, payment, and permission changes.

## Privacy Requirements

- Do not include customer private data in security reports.
- Keep audit detail access controlled.
- Do not add hidden tracking.

## Acceptance Criteria

- Security page does not overclaim implementation.
- Secret leak checks remain server-safe.
- Setup-mode is clear when checks are placeholders.

## Test Requirements

- Test no public service-role env usage.
- Test setup-mode state.
- Test static checklist labels are honest.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Security signoff before production launch.
