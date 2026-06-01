# Growth Campaigns

## Problem

Owners need simple campaign planning without fake analytics, guaranteed revenue claims, hidden tracking, or automatic customer contact.

## Users

- Business owners
- Creators
- Growth reviewers

## User Stories

- As an owner, I can plan a campaign.
- As an owner, I can keep campaign ideas draft-only.
- As a reviewer, I can verify no guaranteed revenue claims are shown.

## Non-Goals

- No automatic customer messaging.
- No fake conversion metrics.
- No guaranteed revenue forecasts.

## Data Model Notes

- Track campaign title, objective, draft status, channels, notes, organization, and timestamps.
- Keep metrics empty unless real instrumentation exists.
- Store approval state before public campaign use.

## Route Requirements

- Owner campaign planning route.
- No public campaign route in MVP unless explicitly approved.
- Empty state when no campaigns exist.

## API Requirements

- Validate campaign title and notes.
- Require organization membership for reads and writes.
- No customer contact API calls in MVP.

## Security Requirements

- Prevent unauthorized campaign changes.
- No hidden tracking pixels.
- No automatic publishing.

## Privacy Requirements

- Do not target sensitive attributes.
- Do not contact customers automatically.
- Customer lists remain private.

## Acceptance Criteria

- Campaign UI shows planning state only.
- No fake live metrics are displayed.
- No automated outreach is triggered.

## Test Requirements

- Test empty state.
- Test no metric claims without data.
- Test draft-only campaign state.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Marketing safety review completed before public campaign claims.
