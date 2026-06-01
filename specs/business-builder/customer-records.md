# Customer Records

## Problem

Owners need private customer records that connect notes, service history, booking, intake, and payment references without exposing private data publicly or adding messaging automation.

## Users

- Business owners
- Admins
- Team members with future permissions

## User Stories

- As an owner, I can view private customer records.
- As an owner, I can keep notes separate from public pages.
- As an admin, I can prepare for future role-based access.

## Non-Goals

- No public customer directory.
- No automatic customer messaging.
- No hidden tracking.

## Data Model Notes

- Track customers, customer notes, and customer events.
- Relate customers to bookings, intake submissions, and payment link references later.
- Add organization ownership to every private record.

## Route Requirements

- Owner-only customer list route.
- Owner-only customer detail route.
- Empty state when no customers exist.

## API Requirements

- Read and write paths require organization membership.
- Public routes must not expose customer records.
- Future exports and deletion controls require explicit owner action.

## Security Requirements

- Enforce owner/admin-only access.
- Prepare audit logging for record access and changes.
- Do not include private customer data in debug logs.

## Privacy Requirements

- Customer records are private by default.
- No public exposure of contact details.
- Future role-based access control must be explicit.

## Acceptance Criteria

- Public users cannot read customer records.
- Empty state shows without demo customers.
- Owner route does not claim live data unless persistence exists.

## Test Requirements

- Test private access assumptions.
- Test empty state rendering.
- Test no public customer data export.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Privacy review completed before enabling writes.
