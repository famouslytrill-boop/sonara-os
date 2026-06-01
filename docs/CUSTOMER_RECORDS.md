# Customer Records

Customer Records are private owner-controlled setup records for Business Builder. They are useful for organizing follow-up without exposing customer data publicly.

## MVP Fields

- Name
- Email
- Phone optional
- Source
- Status
- Tags
- Notes
- Last contacted date
- Next follow-up date
- Consent status
- Communication preference
- Permission note

## Follow-Up Queue

The follow-up queue supports draft records for:

- Draft follow-up
- Booking reminder
- Review request draft
- Win-back draft

These are drafts only. They do not send messages, call external services, or publish customer details.

## Routes

- `/business-builder/customers`
- `/business-builder/customers/follow-up`
- `/growth-studio/win-back`

## Current Status

The current implementation stores setup records locally in the web shell. Production persistence still needs organization-scoped database tables, RLS policies, audit logging, and owner/admin access controls.
