# The steps only you can take

Four of them. Each is written to be run, not interpreted — the SQL, the exact
dashboard path, and how to tell whether it worked.

Nothing in this list can be done from inside the repository, which is why it is
a list rather than a commit. Everything that could be done from inside it has
been.

---

## 1 — Buy a plan in production, once

**Why nobody else can.** It needs a real card against the live Stripe account.
No test substitutes for it, and thirteen catalog products depend on the path.

**Do this.**

1. In production, sign up as a new customer with an email you control.
2. Buy any paid plan.
3. Confirm the entitlement lands: open the workspace that plan unlocks. It
   should open, not show "setup required".
4. Refund yourself in Stripe afterwards if you want; the entitlement test is
   the checkout, not the money.

**How to tell it worked.** `scripts/verify-production-product-catalog.mjs`
reports `positiveSubscribedUserTest: "pending"` on every deploy today. It is
the only thing in the release output that is honest about being unproven. Once
you have done this, tell me and I will change it to report the date it was
proven rather than the word pending — that is a one-line change I should not
make before it is true.

**If it fails**, send me the checkout URL and what you saw. A failure here is a
real finding, not a mistake on your part.

---

## 2 — Turn on Supabase leaked-password protection

**Why nobody else can.** It is a dashboard toggle on the live project. The
Supabase MCP connection this repository uses is read-only by contract, asserted
in `scripts/verify-supabase-contract.mjs`.

**Do this.**

1. Supabase dashboard → **Authentication → Providers → Password**.
2. Enable **leaked password protection**.
3. Set the environment variable `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true`
   in Vercel, for Production.

**Step 3 is the part that is easy to skip and matters most.** Until that
variable is set, the deploy prints a warning and passes either way — so a green
deploy currently tells you nothing about whether the toggle is on. Setting it
turns the warning into a gate.

**What is already covered without it.** The application refuses breached
passwords itself at signup and password reset
(`lib/sonara-leaked-password.cjs`), so the paths in this repository are done.
The toggle covers every path Supabase Auth serves, including ones this
application does not own.

---

## 3 — Put four authorization functions into version control

**Why nobody else can.** They exist in the live database and in no migration,
so this repository cannot read them. This is the most serious item on the list,
and it is not the one the security advisor flagged.

    is_admin()            is_current_user_admin()
    has_scope(...)        has_company_access(...)

These are authorization primitives. An authorization primitive nobody can read
is one nobody can review, and no care about its `EXECUTE` grant compensates for
not knowing what it does.

**Do this.** Run the query below in the Supabase SQL editor and send me the
output. I will turn it into a migration so the definitions live in version
control from then on.

```sql
select
  p.proname as name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'is_current_user_admin', 'has_scope', 'has_company_access')
order by p.proname;
```

**It is also proof of something broader.** Functions and policies are being
created outside migrations. That is the limit on every report in this
repository that reads migrations to reason about the live database — including
the security-definer exposure report. Worth knowing regardless of what these
four turn out to do.

---

## 4 — Try one `EXECUTE` revoke, on a preview branch only

**Why nobody else can.** It needs a database you can afford to break.

The advisor's remediation is to revoke `EXECUTE` from `authenticated` on twelve
`SECURITY DEFINER` functions. **Do not do that.** Seven of them are load-bearing:
`is_org_member` alone is called by **197 policies across 59 tables**, and a
policy evaluates as the calling role, so removing the grant can turn a working
policy into a denial — customers locked out of their own records, silently.

Exactly one is safe on this repository's own evidence. `sonara_has_org_role` is
called by **no policy** and appears to be a superseded twin of `has_org_role`.

**Do this, on a preview branch and not on production.**

```sql
-- Preview branch only. Reversible; the grant is restored at the bottom.
revoke execute on function public.sonara_has_org_role(uuid, text[]) from authenticated;

-- Then exercise the app against the branch: sign in, open a workspace, open
-- records, save one. Every one of those paths runs through RLS.
--
-- If anything denies that should not, restore it immediately:
-- grant execute on function public.sonara_has_org_role(uuid, text[]) to authenticated;
```

**How to tell it worked.** Nothing changes. That is the expected result — the
function is called by no policy, so revoking it should be invisible. If
something *does* break, that is the finding: it means a policy calls it from
outside version control, which is item 3's problem showing up again.

**Then tell me**, and I will write it as a migration. I have not written one
pre-emptively, because a migration in this repository runs on deploy, and
shipping this without the branch test would be acting past the evidence.

**The other eleven stay as they are.** Seven because 197 policies is not a
number to gamble with, and four because they are the ones nobody can read yet.

---

## What is not on this list, and why

**Pricing.** `docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` recommends Free $0
/ One workspace $19 / All three $39 / Team $79, with $19 chosen so no existing
Core customer pays more. It is not here because item 1 comes first: changing
prices on a path nobody has walked is changing a number nobody has tested. Once
you have bought a plan in production, tell me to apply it and I will do the code
half — the new entitlement keys — while you create the Stripe price objects.

**Legal review.** Every legal page states the terms are not legal advice, and a
test asserts no page ever claims attorney review. Engaging counsel is a business
decision, not a shipping step, and keeping it on a checklist made the checklist
permanently unfinishable.
