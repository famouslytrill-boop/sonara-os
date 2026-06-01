# Money Path

## Problem

Owners need a safe way to present payment options without storing raw card numbers, CVV, bank credentials, provider secrets, or fake payment status.

## Users

- Business owners
- Customers
- Support reviewers

## User Stories

- As an owner, I can list provider-hosted payment links.
- As a customer, I can choose a clearly labeled payment option.
- As a reviewer, I can verify no sensitive payment credentials are stored.

## Non-Goals

- No direct card processing.
- No custody claims.
- No fake active subscription or payment state.

## Data Model Notes

- Store provider type, display label, external URL, status, organization, creator, and timestamps.
- Do not store provider secrets or payment credentials.
- Track review status for external links.

## Route Requirements

- Owner setup route for payment links.
- Public display route only for approved links.
- Empty state when no links are connected.

## API Requirements

- Validate URLs before saving or displaying.
- Reject non-http and non-https protocols.
- Webhook verification is required before future provider automation.

## Security Requirements

- Never accept raw card numbers, CVV, or bank credentials.
- Keep provider secrets server-only.
- Require organization membership for management.

## Privacy Requirements

- Do not reveal private billing setup notes.
- Do not expose customer payment records in public UI.
- Do not log sensitive payment data.

## Acceptance Criteria

- Unsafe payment URLs are rejected.
- Public display never claims payment processing is active unless real configuration exists.
- Owner can see honest setup states.

## Test Requirements

- Test URL validation rejects unsafe protocols.
- Test empty state with no links.
- Test no sensitive fields exist in the model.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Payment safety review completed before enabling writes.
