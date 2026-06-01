# Business Autopilot Board

Internal package for routine workflow records, safe automation policy checks, human approval gates, action queues, routine task runners, and automation audit ledger models.

This package does not send customer messages, publish offers, change pricing, change payment links, delete data, disable security features, or run external syncs by itself. It classifies and queues actions so the app can show what is safe, what requires owner/admin review, and what is blocked.

## Safety Rules

- Auto-safe actions can create internal tasks, draft messages, update setup checklists, flag missing information, generate non-public recommendations, and queue reminder drafts.
- Owner-review actions remain pending until explicit owner review.
- Admin-review actions require elevated review before execution.
- Blocked actions cannot run through the routine task runner.

## Validation

Run from the repo root:

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke
```
