# Shared SONARA Billing — Customer Journey Engineering Pass

Status: **draft**, review-only. No live checkout, merge, migration or deployment authorized.

## Verified source defect

Before this pass, `GET /billing` redirected every signed-in customer to
`/business-builder/billing`. The destination is guarded by
`requireWorkspaceAccess("business_builder")`. However, Creator Studio and
Growth Studio each route their own `/billing` link to `/billing`, and the
Stripe billing portal also returned every customer to Business Builder.
Consequently a legitimate creator-only or growth-only customer could be sent
to a workspace their plan did not include.

## Implemented behavior

- `GET /billing` is the canonical SONARA account-level billing screen,
  protected by `requireCustomer` instead of any single-product gate.
- Readiness, the signed-in customer's verified organization and existing
  tenant-scoped subscription summary power the exact same billing controls
  that were previously accessible only on the Business Builder page.
- `GET /business-builder/billing` is preserved for existing links and
  authorized Business Builder users.
- The existing Creator and Growth billing entry routes still use their own
  workspace gate and redirect to the new shared billing screen.
- A newly generated Stripe Billing Portal session sends its return URL to
  `/billing` rather than `/business-builder/billing`. Its fallback is also
  `/billing`. The portal's `return_url` is a customer-navigation setting,
  not payment confirmation.
- No workspace is unlocked by visiting billing. Paid access is still
  determined by server-side subscription and entitlement records.

## Evidence and regression tests

New tests in `tests/server.test.js` assert:
1. Authenticated `GET /billing` returns a real page containing subscription
   controls with no Business Builder redirect or paid-workspace requirement.
2. Authorized Creator Studio and Growth Studio billing links point to
   `/billing`; the shared page renders when reached.
3. Stripe Portal session requests contain `return_url` with the shared
   `/billing` path, rather than the Business Builder path.
4. Existing Business Builder billing page remains unchanged.

The implementation references Stripe's Billing Portal Sessions API: the
`return_url` is the URL customers visit when returning to the merchant site.
https://docs.stripe.com/api/customer_portal/sessions/create

## Review and deployment requirements

- [ ] Exact-head focused Mocha tests and full `pnpm run verify:launch` passing.
- [ ] Regenerate/check all generated route, capability and handoff inventories.
- [ ] Test signed-out and customer-only access, including Creator-only,
  Growth-only, Business-only, All Three, expired and canceled subscriptions.
- [ ] Verify the canonical site origin protections in **draft PR #555**
  are reviewed and integrated first or as a conflict-resolved merge.
- [ ] Verify real Stripe sandbox Customer Portal session initiation, return,
  subscription cancellation, webhook processing and correct plan relock.
- [ ] Validate production migration/RLS classifications, branch protection,
  accessibility, browser state, logging, rollback and provider configuration.
- [ ] Obtain explicit owner deployment authorization; preserve the current
  owner-controlled offline website state.

This change is source-level implementation and regression coverage, not
evidence of a paying-customer transaction or successful deployment.
