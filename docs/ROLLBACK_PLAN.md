# Rollback Plan

Rollback is required before public launch. A launch is blocked until the owner knows how to return the app to a previous safe state.

## Rollback Triggers

- Production build fails after deployment.
- Public pages, auth, billing, or admin routes crash.
- Stripe checkout, webhook, or pricing behavior is wrong.
- Database migration causes data access failures.
- Security scan finds leaked secrets or public source maps.
- Legal, privacy, or pricing pages show unapproved public claims.

## Rollback Steps

1. Pause new public launch announcements or beta invites.
2. Revert to the last known-good deployment in the hosting provider.
3. Disable risky feature flags or setup flows if needed.
4. If a migration caused the issue, follow the reviewed database rollback notes before changing data.
5. Re-run local validation:

```bash
pnpm run validate:infrastructure
pnpm run typecheck
pnpm run build
pnpm run smoke
```

6. Record the incident, owner, root cause, and follow-up fix in the operations log.

## Database Rollback Notes

- Do not run destructive database commands without a reviewed backup.
- Do not delete customer, billing, audit, or organization data to force a rollback.
- Keep schema rollback scripts separate from product feature changes.

## Communication

- Owner communicates launch pause and recovery status.
- Support contact monitors inbound reports.
- Public status page remains private/off by default until intentionally approved.
