# Offer Builder

## Problem

Owners need a small way to define services or offers for profile, booking, intake, and payment pages without creating pricing promises or complex catalog behavior.

## Users

- Business owners
- Creators
- Prospective customers

## User Stories

- As an owner, I can describe a service offer.
- As a visitor, I can understand what the owner provides.
- As an owner, I can keep offers draft-only until reviewed.

## Non-Goals

- No inventory management.
- No guaranteed pricing outcomes.
- No automated offer optimization.

## Data Model Notes

- Store title, short description, optional price label, status, organization, and timestamps.
- Link future offers to booking, intake, and proof profile surfaces.
- Keep display-only pricing labels separate from payment processing.

## Route Requirements

- Owner route for offer setup.
- Public display only when explicitly published.
- Empty state when no offers are published.

## API Requirements

- Validate title and description length.
- Require organization ownership for writes.
- Do not auto-publish created offers.

## Security Requirements

- Only organization members can manage offers.
- Avoid injecting owner-entered HTML into public pages.
- Audit publish actions when available.

## Privacy Requirements

- Private setup notes stay owner-only.
- No customer-specific offer data is public.
- No hidden segmentation.

## Acceptance Criteria

- Draft offers are not public.
- Public offers show plain display-only content.
- No payment processing behavior is added.

## Test Requirements

- Test draft versus published visibility.
- Test input length validation.
- Test empty public state.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Product review confirms no revenue guarantees.
