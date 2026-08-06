# Ship readiness

What is done, what is deliberately still closed, and the three things that
cannot be closed from inside this repository.

Written to be read before launch and then again a month later, when the reason
something was left open has been forgotten.

---

## The state of the paid path

Thirteen of thirty-four catalog products execute. Twenty-one do not.

That split is real rather than provisional. A paid product executes only where
the server enforces an entitlement for its product family — `business_builder`,
`creator_studio` and `growth_studio` have one; `sonara_industries` does not, so
its nine paid entries stay shut. The remaining twelve are shut on lifecycle:
planned, validation-required or setup-required.

Until recently that number was three. The catalog defined "paid access is
verified" as `planFloor === "free"`, which made every paid product permanently
unreachable — not pending a check somebody could run, but false by construction
— while the deploy printed "paid execution remains restricted until positive
production entitlement verification" on every release, which reads like pending
work rather than a definition that could never come true.

**The one thing still unproven:** nobody has completed a paid signup in
production end to end. `positiveSubscribedUserTest` reports `"pending"` on every
deploy and should keep reporting it until somebody runs one. Thirteen products
now depend on that path, and it is the last genuine unknown in it.

---

## Three things only the owner can close

### 1. A positive subscribed-user test in production

Buy a plan in production with a real card, confirm the entitlement lands, and
confirm the product it unlocks actually opens. Nothing in this repository can do
this, and no amount of test coverage substitutes for it.

### 2. Supabase leaked-password protection

Still disabled, reported by the security advisor on 2026-07-27. It is a
dashboard toggle: **Authentication → Providers → Password**.

The application already refuses breached passwords on its own at signup and
password reset (`lib/sonara-leaked-password.cjs`), so the paths in this
repository are covered. The dashboard setting covers every path Supabase Auth
serves, which is a wider guarantee.

After enabling it, set `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true`. Until
that variable is set, the deploy prints a warning and passes either way — so a
green deploy currently tells you nothing about whether the toggle is on.

### 3. Twelve authorization functions are callable by any signed-in user

Replaces the legal review that sat here. That was not a shipping step — it is a
decision about engaging counsel, and parking it on this list meant the list had
a permanent item nobody could close. The legal position is unchanged and stated
where it belongs: every legal page says the terms are not legal advice,
`tests/server.test.js` asserts that and asserts no page ever claims attorney
review, and `/readiness` still carries both the "Legal pages" and "Legal review
boundary" cards.

What replaces it is real, current, and came from the live project rather than
from this repository. Supabase's security advisor reports:

**Twelve `SECURITY DEFINER` functions are executable by the `authenticated`
role over `/rest/v1/rpc/`.** These are the authorization primitives themselves:

    is_admin()                     is_current_user_admin()
    has_org_role(...)  (x2)        is_org_member(...)
    has_scope(...)                 is_org_owner_or_admin(...)
    has_company_access(...)        is_entity_member(...)
    has_entity_role(...)           can_manage_entity(...)
    sonara_has_org_role(...)       sonara_is_org_member(...)

A `SECURITY DEFINER` function runs with its owner's privileges, so it is not
subject to the row level security that would otherwise apply. Each of these
appears to answer a question about the caller and return a boolean, which is why
this is a warning rather than an open door — but they are the functions every
RLS policy in the schema depends on, and they are reachable directly.

**This has not been changed, deliberately.** Revoking `EXECUTE` from
`authenticated` is the advisor's suggested remediation, and it is exactly the
change that could silently break every RLS policy that calls them: a policy
evaluates as the calling role, so removing the grant can turn a working policy
into a denial. Verifying that needs a database somebody can break — a preview
branch — not a guess. It is written down here rather than acted on because
acting on it wrongly locks customers out of their own records.

**Leaked password protection is still disabled**, confirmed against the live
project rather than assumed. Item 2 above covers it.

**Fifteen tables have RLS enabled with no policy**, reported as INFO. That is
the safe state, not a gap: RLS with no policy denies everything except the
service role, which is what a service-role-only table should do. Recorded so
nobody "fixes" it by adding a permissive policy.

The Supabase MCP connection is read-only by contract
(`scripts/verify-supabase-contract.mjs` asserts `read_only=true` in the config),
so all three were read and none could be changed from here.

---

## Closed, and worth knowing why

**Stripe prices.** The three stale prices are archived. Archiving is the
complete action — Stripe Price objects cannot be deleted — and checkout already
refuses an archived price (`lib/sonara-billing.cjs`, `price_archived`), so one
cannot silently take money.

---

## What the product does not claim

These are enforced by tests rather than remembered, because each is the kind of
promise that creeps back in through ordinary copy edits:

- No revenue, ranking, compliance or security outcome is guaranteed.
- Nothing is described as AI. These are tools and checklists.
- Nothing that needs setup is described as if it already works.
- No third-party brand is named as an endorsement.
- Legal pages never claim a review that has not happened.

---

## Boundaries that must not be quietly relaxed

Each of these was a defect once. The tests exist because the failure was
invisible until production, and the comment in each test says which incident it
came from.

| Boundary | Why it is load-bearing |
| --- | --- |
| `entitlementIntegrationVerified` must never revert to `planFloor === "free"` | It defined verified access as free access and shut thirty-one paid products by construction |
| Applied migrations are never rewritten | The edit reaches the file and never reaches the database |
| `layout()`'s `surface` defaults to `"work"` | A page that forgets to declare itself comes out calm, not animated |
| Entrance styles stay behind `data-sonara-depth="ready"` | A blocked or stale script must not be able to hide the page |
| The leaked-password check fails open, and never runs on login | A third-party outage must not stop signups, and must not lock anyone out mid-recovery |
| `NEW_PASSWORD_MIN_LENGTH` 12, `EXISTING_PASSWORD_MIN_LENGTH` 8 | Raising the login floor locks out every customer whose password predates it |
| Experience preferences keep one persisted store | Two stores meant the settings dialog reported a choice it was not applying |
| Motion `"on"` maps to `"auto"` | An in-app choice must never override `prefers-reduced-motion` |
| The document makes zero third-party requests | A page load must not tell anyone else that it happened |

---

## Verifying a release

`pnpm run verify:launch` runs the chain. If it is blocked, run the steps
individually:

```
build · test · scan:client-secrets · lint · smoke:routes · verify:db
verify:config · verify:api · verify:stripe · verify:tenant-tables
verify:member-policies · verify:catalog-sync · verify:open-source
```

Production deploys only through `.github/workflows/controlled-production-deploy.yml`
— migrations first, then the catalog boundary gate, then Vercel, then the
post-deploy page gates.

**A green deploy is not proof on its own.** The post-deploy gate fetches the
catalog page; it does not fetch every asset. When a release ships something new
— a font, a page, an image — fetch it from production and confirm it is really
there. Self-hosted fonts would have 404'd silently behind system fallbacks and
every gate would still have passed.

---

## Known and deliberate

- **Fourteen entries in `data/open-source-tools.ts` still carry a generic
  `https://github.com/` placeholder.** The gate warns about each on every run.
  They are resolved one at a time with the licence read from the project, not
  assumed — Remotion turned out not to be MIT, and requires a paid company
  licence above a size threshold.
- **The language control translates roughly 12% of a page** — navigation,
  buttons and headings. It now says so before you choose. Full translation needs
  human translators.
- **Thirteen tables have RLS enabled with no explicit policy**, which closes them
  to everything except the service role. That is the intent, and the deep
  verification reports it every run.
