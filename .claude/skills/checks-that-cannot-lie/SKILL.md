---
name: checks-that-cannot-lie
description: Write, audit, or fix a check, test, gate, or report in SONARA One so it cannot report success while being false. Use when adding a verification script or release-chain command, when a check has never failed, when auditing whether an existing gate still holds, or when hunting the recurring defect where a value is fetched into a decision and never used.
---

# Checks that cannot lie

The recurring defect in this codebase is not broken code. It is **a signal that
reports success without being true**. Several have been found and fixed. Assume
more exist.

This skill is the accumulated shape of them and how to avoid adding another.

## The rule

**Before you trust a check green, make it fail.** Break the thing it tests, watch
the check go red, put it back. A check that has never failed is a check nobody
has verified — and writing one is worse than writing none, because now there is a
green light over the problem.

Every check added this way should be recorded in `docs/SPRINT_LOG.md` with what
was broken to prove it works.

## The eight shapes, each with the case that produced it

### 1. Passing by measuring nothing

A list-based check satisfied by an empty list. The crawl that reported every page
honest while crawling zero pages; the sweep that found no uncontracted table
references while not reading the directory containing them.

**Guard:** assert the population is non-empty *and* plausible, with a message
saying the check has gone blind.

```js
assert.ok(pages.length >= 5, `only ${pages.length} pages found; this check has gone blind`);
```

### 2. Measuring a different population from the one claimed

`scripts/verify-supabase-contract.mjs` scanned `server.js` and `routes/` and
called it "the runtime". `lib/` is runtime too, and it held the queries the scan
was looking for. A scan naming two of three directories measures something real
and reports it as something else.

**Guard:** name the population in the output. `110 runtime files, 51 selects
examined` is checkable; "verified" is not.

### 3. A value fetched into a decision and never used

The sharpest one. `evaluatePolicy` selected `consent_scope` on every voice job —
the field recording what a person agreed to — and compared it to nothing. **Being
in the `select` list is what made it look checked.**

`pnpm run report:selected-columns` hunts exactly this. Read its two tiers: tier 1
gates, tier 2 is advisory because helpers reading a caller's row are normal here.

**Guard when writing:** if you fetch it, use it or stop fetching it.

### 4. Absent read as false, or as zero

`null` is not `[]` is not `0`. A column that did not come back is not a column
that is false.

- `Number(null)` is `0` and finite, which made unpriced services read as free
  across twenty-three columns. Use `finiteNumber` from
  `lib/sonara-owner-record-pages.cjs`.
- A failed read rendered as "you have no records" tells a customer a definite
  thing about their own data on the strength of a request that did not happen.
  Carry the outcome, not just the rows: `{ ok, rows }`, never a bare array.
- Three states, not two, wherever a person may not have answered:
  yes / no / **not recorded**.

### 5. An exemption whose reason has expired

A form-reachability exemption read "no page displays `location_zones`" while
`/business-builder/routes` had displayed them the whole time. **A wrong reason
inside an exemption is worse than no exemption**, because it is what the next
person reads instead of checking.

**Guard:** make the list two-sided. Fail when something unaccounted appears *and*
when a recorded reason no longer describes anything. `report-orphan-tables.mjs`
does both; copy it.

### 6. A check too weak to catch the bug it was written for

The first version of `report-unused-selected-columns.mjs` compared each column
against the whole file. The file naming `consent_scope` eight times hid the one
function ignoring it, so reintroducing the original bug left the check green. It
was thrown away and rewritten per-function rather than shipped.

**Guard:** the failure test is not optional. Reproduce the motivating bug and
confirm the new check catches *that*.

### 8. Verified in the one state where the code under test does nothing

The most expensive of these so far, because it cost a production deployment
rather than an hour.

`20260812000000_existing_tables_reach_the_shape_later_migrations_expect.sql`
adds columns that a live table is missing. `verify-migration-replay.mjs` applies
every migration to an **empty** PostgreSQL and reported it green.

It was green because the migration one version earlier creates each of those
tables **whole**. Against an empty database every statement in the file is a
no-op. The check proved the SQL parses. It could not have failed.

That is exactly what happened one migration earlier, too, and there it shipped:
`20260811210000` is 42 `create table if not exists`, and against an empty
database that is a full exercise — so a clean replay felt like proof. It was
proof of the wrong thing. Production's tables were **present in an older shape**,
which is the one state `if not exists` does nothing about, and the deployment
died on a missing column the replay had no way to see.

**The tell:** the fixture is the state the change assumes rather than the state
that exists. An empty database is where a repair for a non-empty database is
guaranteed to be a no-op.

**Guard: build the broken state, then run the thing.** Not "does it apply" —
*does it repair*:

```js
psql("alter table public.customers drop column organization_id cascade;");
behaves(psql, "the degraded database really is missing the column",
  "select 'degraded_' || count(*) from information_schema.columns where …", ["degraded_0"]);
psql(null, { file: theRepairMigration });
behaves(psql, "the column is added back", …, ["customers_organization_id_1"]);
psql(null, { file: theMigrationThatFailedInProduction });   // the part that matters
behaves(psql, "the statement that failed now runs", …, ["customers_policy_1"]);
```

Three things that pair of probes taught, each worth copying:

- **Assert the degraded state before repairing it.** Without the middle
  assertion the probe passes if the `drop` silently did nothing, which is a
  check that proves the fixture rather than the fix.
- **Re-run the statement that actually failed.** Asserting the column exists
  says the repair did *something*. Only running the migration production died on
  says it did the *right* thing — and that assertion was the only one that
  caught the column being re-added with the wrong type.
- **Re-applying to an already-repaired database proves idempotency for free**,
  which is what makes it safe to slot in under `--include-all`.

### 7. A pattern that matches prose as if it were code

The most frequent one in practice, and the easiest to write by accident. A check
greps for a name and finds it in a **comment, a filename, a docstring or the
very sentence explaining why the thing is absent** — so it passes, or reports a
defect that is not there. Five instances in a single session on 3 September 2026:

| the pattern | what it matched | what it did |
| --- | --- | --- |
| `schedule\.([a-z_]+)` | `sonara-agent-schedule.cjs` in a comment | demanded a column called `cjs` |
| `!sql.includes("billing_customers")` | the comment saying it is *not* created | failed a correct migration |
| leak check for `service_role` | `20260727024500_service_role_extension_grants.sql` | reported a secret leak in a filename |
| `'([a-z_0-9]+)'` over a pairs array | both halves of every pair | inverted retired and successor for five tables |
| `AUDIT.match(/billing_webhook_events/)` | the comment explaining the change | let a probe pass that should have failed |

The fourth is the expensive kind: it did not merely misfire, it produced a
**confident wrong conclusion** — a live table removed from a health check on the
strength of a name appearing in a list nobody had read the shape of.

**Guard, and it is nearly always the same two lines.** Strip comments before
matching, and anchor on the syntax rather than the name:

```js
const code = source.replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
// and prefer a lookbehind that cannot start mid-identifier
for (const m of code.matchAll(/(?<![-\w.])schedule\.([a-z][a-z0-9_]*)\b/g)) …
```

Two further rules that come out of the same session:

- **Read the shape of a list before extracting from it.** `array[['a','b'],…]`
  is not a list of names; it is pairs, and which position a name sits in is the
  whole meaning. Parse the structure, then assert the count the source itself
  claims — `assert.equal(retired.size, 13)` is what caught the pairs error on
  the first run.
- **A negative assertion is the dangerous direction.** `assertNotIn(x, text)`
  fails on prose mentioning `x`; `assertIn` usually does not. Strip comments
  before every negative check, and keep positive checks on the raw text, because
  a `create table` line that has been commented out is not a create table.

### Probing: grep for the message the *first* assertion produces

A probe that greps the suite output for a message can report **DID NOT FAIL**
when the test failed perfectly well, because an earlier assertion in the same
test aborted the method before the message you grepped for was reached. This
happened twice in one session. Two habits fix it:

- give **every** assertion its own message, not just the interesting one;
- when a probe reports no failure, look at the run before believing it.

### Restoring after a probe

Copy the file aside and copy it back. **Never `git checkout --`.** It reverts to
the last commit, which silently discards any uncommitted work in that file —
including the fix you are in the middle of probing. This is written down because
it has now cost work twice, the second time by somebody who had read this line.

## Writing a new release-chain command

1. Put it in `scripts/`, named `verify-*` or `report-*`.
2. It reads the repository, never a remembered figure.
3. Exit non-zero with a message naming what to do, not just what is wrong.
4. Guard against measuring nothing (shape 1) and say so on stderr.
5. Never silently downgrade. If a dependency the check needs is missing, **stop**
   — a check that falls back to a weaker measure while still printing "passed" is
   the defect this file is about.
6. Add it to `package.json` as its own script and to the `verify:launch` chain.
7. `verify-doc-counts` will now fail: the chain length is quoted in
   `docs/owner/WHAT-IS-LEFT.md` and is derived. Update it.
8. Break something. Watch it fail. Then commit.

## When you write a reason in a comment

Make sure it is a reason you **verified** rather than one you reasoned your way
to. The second kind reads exactly like the first, and this repository has shipped
several. If you cannot say which file you opened to confirm it, say so in the
comment instead of asserting it.
