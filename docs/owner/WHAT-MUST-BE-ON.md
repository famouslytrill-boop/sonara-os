# What has to be on before you take money

Derived from the code on 12 August 2026, not recalled. `pnpm run verify:env`
checks the classification behind this document on every release, so it cannot
drift away from what the application actually reads.

Fifty-eight environment variables are read. **Ten of them are required.** One is
a ratchet, one must never be on in production, and the other forty-six are
either optional capabilities or set by the platform.

---

## The ten that are required

Without any of these, a paying customer cannot be served.

| Variable | What breaks without it |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | No database. Every workspace reads "setup required". |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No sign-in. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side reads fail; every record page is empty. **Server-only — never expose it.** |
| `STRIPE_SECRET_KEY` | No checkout. Nobody can buy anything. |
| `STRIPE_WEBHOOK_SECRET` | Payments succeed and **entitlements never land** — the worst failure on this list, because the customer is charged and gets nothing. |
| `RESEND_API_KEY` | No email: no password reset, no receipts. |
| `RESEND_FROM_EMAIL` | Same, and a wrong value fails silently at the provider. |
| `NEXT_PUBLIC_SITE_URL` | Checkout return links and emails point at the wrong host. |

The webhook one deserves the emphasis. Checkout completing is not the same as
the entitlement arriving; the webhook is what connects them. It is also the one
whose absence looks fine from the outside.

## The one that must never be on

**`SONARA_ALLOW_MANUAL_ORG_ID`.** It accepts an `organization_id` straight from
the request body with no membership check — there cannot be one, because the
branch exists to work without a resolved session. While it is on, any request
can name any organization, and every owner-record write that resolves through it
writes into whichever tenant the body asked for.

It was gated on the variable alone, so one wrong value in a production dashboard
was a cross-tenant write hole with nothing in the release chain looking at it.
**The code now refuses it in production regardless of the value** — `NODE_ENV`
and `VERCEL_ENV` are both checked — and `tests/manual-org-id-guard.test.js`
fails if that guard is removed. Setting it to `false` is the second lock, not
the only one.

## The one that turns a warning into a gate

**`SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true`**, after enabling
**Authentication → Providers → Password** in the Supabase dashboard.

Until it is set, the deploy prints a warning and passes either way — so a green
deploy currently tells you nothing about whether the toggle is on. This is
`docs/owner/OWNER-STEPS.md` item 2, and it is the step most likely to be
half-done: people flip the dashboard switch and never set the variable, so
nothing afterwards can confirm it.

## What is optional, and why that word is safe here

Forty of the fifty-eight are capabilities. Every one of them degrades to a
stated "setup required" rather than an error, and **none may become a launch
dependency** — that is enforced by the release checks, not by intention.

That includes all six service adapters (Ollama, Langflow, Open WebUI, Crawl4AI,
Dify, RAGFlow), every analytics key, and every media provider. None of them are
on, and the product is complete without them: the record checks, the money
figures and the chase drafts are all arithmetic over the owner's own rows.

## What being "on" does not cover

Configuration is necessary and it is not sufficient. Three things sit outside
this file:

**Nobody has completed a paid signup in production.** Every variable above can
be correct and the path still be untested. `OWNER-STEPS.md` item 1.

**Prices.** `STRIPE_PLANS` still reads Free / Starter $7 / Core $19 / Pro $39,
and `docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` recommends changing it.
That is a decision, not a setting.

**The four authorization functions that exist in the live database and no
migration.** `OWNER-STEPS.md` item 3. No environment variable affects them.

---

## How to check it yourself

```
pnpm run verify:env
```

It reads every `process.env` reference in the source, requires each name to be
classified, and fails in both directions: a variable the code reads with no
classification, and a classification for a variable nothing reads. The second
half is why it was rewritten — the previous version was a hand-typed list where
seven of twelve "required" names were read by nothing at all.
