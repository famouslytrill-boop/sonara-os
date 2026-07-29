# User-scoped reads (CRIT-3 item 2)

**Status:** prerequisites done and deployed. The switch itself is not done, and
is deliberately gated on evidence that cannot be gathered from a development
machine.

## What the item is

Every Supabase call this application makes uses the service-role key. That key
**bypasses Row Level Security entirely**, so the tenant boundary today is
whatever the query string says — `organization_id=eq.…` and nothing else. A
missing filter is a cross-tenant read, and only code review stands in the way.

Item (2) is to forward the caller's own JWT on user-facing reads, so the
database enforces the boundary a second time and a missing filter returns
nothing instead of somebody else's rows.

## Why this took three steps instead of one

Measuring the schema before starting found the prerequisite nobody had
recorded:

| | |
| --- | ---: |
| tenant-scoped tables | 206 |
| readable by a signed-in member | 22 |
| policy exists, but only for `service_role` | 45 |
| **no SELECT policy at all** | **139** |

Service-role ignores all of that, which is why the application works. But
switching a read to a user JWT against any of those 184 tables returns **zero
rows and HTTP 200**. Not an error — an empty workspace that looks like a
customer with no data. Doing item (2) first would have taken the product down
quietly.

## What is done

1. **`20260728120000_member_read_policies.sql`** — member SELECT policies for 33
   tables. Applied in production.
2. **`20260729040000_member_read_policies_core_tables.sql`** — the same for the
   ten tables a real customer read path actually touches, which the first
   migration missed. Applied in production.

   The first list was measured by exercising every GET route **anonymously**,
   and anonymous is not a customer: every read behind
   `getCustomerPrimaryOrganization` needs a session, so no core table executed.
   Of its 33 tables the runtime names 3. `tests/member-read-policies.test.js`
   now measures against the shipped runtime instead.
3. **`lib/sonara-supabase-clients.cjs`** — `chooseClient()`, which returns
   `service_role` on every uncertainty and only returns `user` for a table on an
   explicit ready list. Nothing calls it yet; that is step 2 below.

Neither migration changes behaviour. Service-role bypasses RLS and nothing
connects as `authenticated`, so an additive SELECT grant to `authenticated`
cannot alter a single existing query's result.

## What deliberately stays on service-role

| Table | Reason |
| --- | --- |
| `billing_webhook_events` | no `organization_id`; Stripe's own event record |
| `support_email_delivery_attempts` | no `organization_id`; delivery diagnostics |
| `business_employee_invites` | holds `token_hash` and pending invitee emails; no customer path reads it — **owner review** |
| `user_roles` | keyed by `user_id`, not `organization_id`; who may read the privilege table is a decision, not a gap — **owner review** |
| `product_modules`, `service_catalog_items` | reference and published-catalog data, not tenant data |

`tests/member-read-policies.test.js` pins this list, so the coverage gap cannot
be closed by quietly opening an operator table.

## The remaining work, in order

### 1. Gather the evidence — needs production, one command

```
NEXT_PUBLIC_SUPABASE_URL=… \
SUPABASE_SERVICE_ROLE_KEY=… \
NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
SONARA_VERIFY_USER_JWT=<access token of a real signed-in customer> \
  pnpm run verify:member-read-access
```

Get the JWT by signing in as a test customer with a real workspace and reading
the `sonara_customer_session` cookie. It lasts an hour by design.

The script counts rows per table twice for the same organization — once as
`service_role`, once as that organization's own member — and reports a table
ready only when the member sees **all** of them. It is read-only and prints no
key or token.

Three outcomes matter:

- **ready** — the member sees every row service-role sees. Safe to switch.
- **blocked** — service-role sees rows, the member sees none. The policy does
  not match. Switching this read would blank the page.
- **no evidence** — the organization has no rows in that table, so an empty
  member read proves nothing. Re-run against a workspace that has data. This is
  a gap in the fixture, not a failure, and the script exits 0 for it on purpose:
  a check that cries wolf gets ignored.

This cannot be done from a development machine or from CI. RLS exists only in
the database, and no test can substitute for it.

### 2. Switch one read, not all of them

Add a single **ready** table to the list `chooseClient()` consults, thread the
caller's access token into that one read path, and ship it. `chooseClient()`
already fails safe — an unknown table, a missing token, or a missing list all
return `service_role`, so the blast radius is one query.

Watch it before adding a second. The failure mode is an empty screen, not an
error, so it will not appear in logs.

### 3. Repeat, then tighten

Once every user-facing read is on a user JWT, the service-role key stops being
the tenant boundary and becomes the thing only server-side jobs use — at which
point `lib/sonara-tenant-guard.cjs` can be narrowed from "check the query has a
filter" to "refuse service-role on a request path at all."

## Why it is not finished here

Step 1 is the gate, and it needs a live database and a real customer session.
Everything that could be built and proved without one has been: the policies,
the measurement that found they were aimed at the wrong tables, the client
chooser that fails safe, the exclusion list, and the verification script with
its own tests.

Shipping the switch without step 1 would be guessing, and the way it fails is
silent.
