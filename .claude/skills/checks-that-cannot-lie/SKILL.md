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

## The six shapes, each with the case that produced it

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
