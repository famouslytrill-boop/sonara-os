# Proof Passport

## Problem

Business owners and creators need a controlled public proof profile that presents services, proof points, and contact actions without exposing private owner data or claiming verification that has not happened.

## Users

- Business owners
- Creators
- Prospective customers

## User Stories

- As an owner, I can draft a proof profile before publishing it.
- As a visitor, I can view only approved public proof details.
- As an owner, I can keep private setup notes out of the public profile.

## Non-Goals

- No automatic publishing.
- No fake verification claims.
- No customer record display.

## Data Model Notes

- Track draft, published, and archived states.
- Separate public fields from owner-only fields.
- Keep timestamps for created, updated, and published events.

## Route Requirements

- Owner setup route for editing draft content.
- Public route for published profiles only.
- Empty state when no profile is published.

## API Requirements

- Read public fields only from public access paths.
- Owner reads require organization context.
- Writes remain draft unless explicit publish action exists.

## Security Requirements

- Organization ownership must be checked before owner reads or writes.
- Publishing must require explicit owner action.
- Audit publish and unpublish actions when audit logging exists.

## Privacy Requirements

- Do not expose private owner fields publicly.
- Do not expose customer names without permission.
- Do not publish contact details marked private.

## Acceptance Criteria

- Public profile only shows published public fields.
- Draft profiles are not visible publicly.
- Missing profile renders a clear empty state.

## Test Requirements

- Test public read excludes private fields.
- Test draft state is not public.
- Test missing profile fallback.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Security review confirms no private field exposure.
