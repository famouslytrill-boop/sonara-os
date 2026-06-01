# Booking/Appointments

## Problem

Owners need a safe booking request flow that collects preferred times without promising calendar availability or auto-confirming appointments.

## Users

- Business owners
- Customers
- Admin reviewers

## User Stories

- As a customer, I can request a booking time.
- As an owner, I can review requests before confirmation.
- As an owner, I can keep requests private.

## Non-Goals

- No calendar automation in MVP.
- No automatic confirmation.
- No email sending until explicitly implemented.

## Data Model Notes

- Store customer name, contact method, contact value, service type, preferred date, preferred time, notes, status, organization, and timestamps.
- Status values include requested, reviewed, accepted, declined, and archived.
- Keep booking requests private to the organization.

## Route Requirements

- Public booking request form.
- Owner booking request list.
- Empty state when no requests exist.

## API Requirements

- Validate required name, contact method, contact value, and service type.
- Insert through safe server path only when persistence is ready.
- Do not expose submitted requests publicly.

## Security Requirements

- Organization members manage requests.
- Public users can submit but not read requests.
- No calendar writes without reviewed integration.

## Privacy Requirements

- Submitted contact details remain private.
- No public booking request listing.
- No automated high-stakes scheduling decisions.

## Acceptance Criteria

- Requests require owner review before confirmation.
- No fake confirmation is shown.
- Missing backend renders setup-mode behavior.

## Test Requirements

- Test required fields.
- Test no public read of submitted requests.
- Test setup-mode fallback.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Privacy review completed before accepting live requests.
