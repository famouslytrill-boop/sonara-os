# Six legal documents are published and nothing declares them

Review by: 2026-10-16

This is an owner decision, not an engineering task. AGENTS.md says legal and
policy publishing requires owner approval, and six legal documents are currently
served to anyone on the internet without appearing in any manifest, sitemap or
indexing policy. Nothing here has been changed. This document says exactly what
is published so the decision can be made from facts rather than from memory.

Everything below was measured against a configured server on **16 September
2026** by opening each URL as an anonymous visitor and reading the returned HTML.

## What is not wrong

Worth stating first, because it was the first thing suspected and it turned out
to be fine.

Each legal document is served at two URLs — a short one and a `/legal/` one —
with **byte-identical content**. That looked like a duplicate-content defect. It
is not. `legalAliasPages()` in `server.js` treats the `/legal/` form as the
canonical `source` and the short form as the alias, and both URLs serve the same
`<link rel="canonical">` pointing at the `/legal/` address. Its own comment
records that this was a deliberate fix:

> `source` must survive the spread — it is the canonical target. Dropping it
> left every alias with no canonical, the reason they needed one.

All eight pairs were checked, and all eight agree:

| Alias (in sitemap) | Canonical target both pages declare |
| --- | --- |
| `/terms` | `/legal/terms` |
| `/privacy` | `/legal/privacy` |
| `/refund-policy` | `/legal/refund-policy` |
| `/cookies` | `/legal/cookie-policy` |
| `/acceptable-use` | `/legal/acceptable-use` |
| `/accessibility` | `/legal/accessibility` |
| `/earnings-disclaimer` | `/legal/earnings-disclaimer` |
| `/subprocessor-notice` | `/legal/subprocessor-notice` |

So a crawler is told which URL wins. No action needed on that.

## Decision 1 — six documents are published with nothing declaring them

These are reachable by anyone, answer `200`, carry a self-referential canonical,
and set **no `robots` meta tag**, so they are indexable. None of them is in
`lib/sonara-route-registry.cjs`, so none has a title, a navigation placement, an
indexing policy or a sitemap entry, and no visibility rule applies to any of
them.

| URL | Size | In the manifest |
| --- | --- | --- |
| `/legal/ai-disclaimer` | 14,534 bytes | no |
| `/legal/payment-terms` | 14,409 bytes | no |
| `/legal/data-processing` | 14,448 bytes | no |
| `/legal/disclaimer` | 14,008 bytes | no |
| `/legal/can-spam` | 13,994 bytes | no |
| `/legal/security-policy` | 14,485 bytes | no |

**The decision:** for each of the six, is it approved as published SONARA legal
text, or should it stop being served?

- **Approved** → it gets a page-manifest entry with a title, an indexing policy
  and a sitemap decision, and it becomes visible to every check that reads the
  manifest. That is a small, mechanical change once the answer is yes.
- **Not approved** → the route is removed. It is live today, so this is the
  answer that needs to be given soonest.

Two of the six are worth naming individually, because their content makes
commitments to customers that other parts of the product have to keep:

- **`/legal/payment-terms`** — this product takes payments through Stripe. Terms
  published at a URL no manifest knows about are still terms.
- **`/legal/data-processing`** — a data-processing description is the document a
  business customer's own compliance review asks for.

## Decision 2 — `/legal/security-policy` and `/security` are two documents

`/security` is declared, public and in the sitemap. `/legal/security-policy` is
undeclared. They are **not** the same document: 13,627 bytes against 14,485, with
different content hashes. Unlike the eight pairs above, this is not an alias
relationship — each canonicals to itself.

What was measured is that they differ. Whether they *disagree* has not been
assessed, and it should be before either is linked anywhere new: two security
policies at two public URLs is a question a customer's security review will ask.

**The decision:** one security document or two? If one, which URL, and the other
becomes an alias like the eight above.

## Decision 3 — one alias is missing from the sitemap

Seven of the eight aliases above are in `PUBLIC_SITEMAP_ROUTES`.
`/subprocessor-notice` is not, and neither is its canonical target. It is
otherwise identical in construction to its seven siblings, so this reads as an
omission rather than an intent.

**The decision:** should `/subprocessor-notice` be advertised like the other
seven?

## What has already been done, so this document is not the only record

None of the above changes what is served. What changed is that these fourteen
routes can no longer be invisible:

- `lib/sonara-route-surface.cjs` declares them under `legal_document_alias` with
  the measurement above and a pointer back to this file.
- `scripts/verify-route-surface.mjs` (`pnpm run verify:route-surface`, in the
  release chain) fails if a new legal URL is served without being declared.
- `tests/a-route-nobody-declared-still-answers.test.js` opens all fourteen as an
  anonymous visitor on every test run and asserts they answer.

Before that work, the page manifest held 308 routes, the server answered 564, and
these fourteen were among the 256 that no check in this repository examined.
