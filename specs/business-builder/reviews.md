# Reviews

## Problem

Owners need a trustworthy reviews and testimonials surface that supports moderation and external profile links without fake reviews, fake ratings, scraping, or undisclosed customer data.

## Users

- Business owners
- Customers
- Prospective customers

## User Stories

- As an owner, I can review testimonials before display.
- As a visitor, I can see only approved trust proof.
- As an owner, I can link to external review profiles.

## Non-Goals

- No fake reviews.
- No fake star ratings.
- No scraping private reviews.

## Data Model Notes

- Track testimonials, review sources, review request links, moderation status, and public visibility.
- Store source type and organization ownership.
- Keep customer contact details private.

## Route Requirements

- Owner moderation route.
- Public approved testimonial display.
- Empty state when no approved testimonials exist.

## API Requirements

- Public reads only approved visible testimonials.
- Organization members manage moderation.
- External review profile URLs require validation.

## Security Requirements

- No auto-publishing testimonials.
- No scraped content ingestion in MVP.
- Audit moderation changes when available.

## Privacy Requirements

- Do not publish customer names without permission.
- Do not expose customer contact information.
- Disclose incentives if future incentives exist.

## Acceptance Criteria

- Only approved visible testimonials appear publicly.
- No fake ratings appear.
- Pending or hidden testimonials stay private.

## Test Requirements

- Test moderation visibility states.
- Test no contact info in public testimonials.
- Test empty public trust state.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Trust safety review completed before public display.
