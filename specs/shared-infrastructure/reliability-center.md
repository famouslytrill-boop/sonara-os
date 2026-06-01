# Reliability Center

## Problem

The platform needs a practical reliability view for build, validation, route health, and deployment assumptions without pretending placeholders are production monitoring.

## Users

- Developers
- Admin reviewers
- Owners

## User Stories

- As a developer, I can see required validation commands.
- As a reviewer, I can identify unresolved launch blockers.
- As an owner, I can understand whether setup is complete.

## Non-Goals

- No fake uptime metrics.
- No automated production fixes.
- No deployment without approval.

## Data Model Notes

- Track check name, status, evidence, reviewer, and timestamps when persistence exists.
- Keep static checks separate from live telemetry.
- Link future incidents to audit logs.

## Route Requirements

- Internal or admin reliability route.
- Clear setup-mode when live checks are unavailable.
- No public stack trace display.

## API Requirements

- Read-only status endpoints until reviewed automation exists.
- No auto-fix endpoint.
- Do not expose secrets in diagnostic output.

## Security Requirements

- Block public stack traces.
- Block production auto-fixes.
- Require launch gate review for deployment changes.

## Privacy Requirements

- Do not include customer private data in diagnostics.
- Keep incident detail access controlled.
- Avoid logging secrets.

## Acceptance Criteria

- Reliability page distinguishes static checks from live telemetry.
- No fake uptime or health metrics appear.
- Build/typecheck/test commands are documented.

## Test Requirements

- Test setup-mode status.
- Test no public stack traces in output.
- Test validation command list remains current.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Release review completed before production deployment.
