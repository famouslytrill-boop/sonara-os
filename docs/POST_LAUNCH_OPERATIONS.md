# Post-launch Operations

The launch handoff must define who watches the app, what they watch, and what action to take when something fails.

## First 24 Hours

- Monitor deployments, build logs, and route health.
- Watch support inbox and feedback form.
- Review billing and checkout activity in Stripe without exposing raw payment data.
- Review database health and auth failures.
- Watch source leak scan and security alerts.
- Track onboarding friction and support requests.

## Daily Checks During Beta

- Run or review:

```bash
pnpm run validate:infrastructure
pnpm run typecheck
pnpm run build
pnpm run smoke
```

- Review `/admin/diagnostics`.
- Review `/admin/go-live-checklist` for unresolved blockers.
- Review `/security-center/launch-security-gate`.
- Confirm no new public claims imply guaranteed revenue, legal advice, or fake integrations.

## Incident Handling

1. Classify severity: low, medium, high, critical.
2. If critical, pause launch activity and follow `docs/ROLLBACK_PLAN.md`.
3. Assign an owner.
4. Capture affected route, deployment, time, user impact, and fix recommendation.
5. Ship the smallest safe fix.
6. Re-run validation before redeploying.

## Operational Boundaries

- No production auto-fixes.
- No hidden customer tracking.
- No automatic customer messaging without owner approval.
- No payment, pricing, role, or security changes without explicit review.
- No public use of beta systems unless they are clearly gated and labeled.
