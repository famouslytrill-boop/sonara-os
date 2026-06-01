# Backup Plan

Production launch is blocked until backup ownership and restore expectations are clear.

## Scope

Backups must cover production data that can affect customers, billing, organization access, proof profiles, audit logs, and customer records.

## Required Before Launch

- Identify the production database provider.
- Confirm automatic backup schedule.
- Confirm retention period.
- Confirm who can restore data.
- Confirm the last restore test or schedule the first restore test.
- Confirm backups do not expose service-role keys or provider secrets.

## Restore Test

1. Choose a non-production restore target.
2. Restore from a recent backup.
3. Verify organization-scoped data is present.
4. Verify RLS and admin protection remain in effect.
5. Verify no fake customers, fake payments, or placeholder-only data are treated as production records.
6. Document date, owner, and result.

## Data Safety Rules

- Do not store raw card numbers, CVV, or full bank credentials.
- Do not export customer records without owner permission and access controls.
- Do not delete audit logs without a documented retention policy.
- Do not use production customer data in public demos.
