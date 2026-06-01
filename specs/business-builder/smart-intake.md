# Smart Intake

## Problem

Owners need a simple intake flow to collect project or service requests without exposing customer submissions publicly or adding premature AI processing.

## Users

- Business owners
- Creators
- Prospective customers

## User Stories

- As a customer, I can submit basic request details.
- As an owner, I can review submissions privately.
- As an owner, I can keep intake questions simple and controlled.

## Non-Goals

- No file upload in MVP.
- No AI processing without consent.
- No public submission listing.

## Data Model Notes

- Track intake forms, questions, and submissions.
- Support short text, long text, email, phone, select, and checkbox fields.
- Store organization ownership and submission status.

## Route Requirements

- Public intake route for submissions.
- Owner route for form setup and private submission review.
- Setup-mode state when persistence is unavailable.

## API Requirements

- Validate required fields and max lengths.
- Insert submissions only through safe server paths.
- Do not expose submitted data through public reads.

## Security Requirements

- Organization members manage forms and submissions.
- Public users can submit but not read submissions.
- Rate limiting should be planned before public launch.

## Privacy Requirements

- Customer submissions are private by default.
- No sensitive file uploads in MVP.
- No hidden tracking.

## Acceptance Criteria

- Submissions are not publicly readable.
- Form fields have accessible labels.
- Missing persistence renders setup-mode messaging.

## Test Requirements

- Test required field validation.
- Test public read path excludes submissions.
- Test setup-mode without backend configuration.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Privacy review completed before accepting live submissions.
