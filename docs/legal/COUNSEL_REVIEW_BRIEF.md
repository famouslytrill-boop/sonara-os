# Counsel Review Brief

`docs/legal/LEGAL_REVIEW_REQUIRED.md` says the public legal pages need qualified
review before paid public launch. It does not say what the reviewer needs to
know, so every review has to start by reading the codebase.

This is that groundwork: the factual state of the system, taken from the code
rather than from the policy text, so counsel can spend the engagement on
judgement instead of discovery.

**Nothing here is legal advice or legal review, and this document does not
replace either.** It is an engineering statement of what the software actually
does. Where a policy page and the code disagree, that is recorded as a finding
below rather than resolved.

Facts verified against the tree at the time of writing. Re-check before relying
on them — the commands used are given so they can be re-run.

---

## 1. What the system actually does

### Cookies

Three, all first-party and `HttpOnly`. There are no others.

| Cookie | Purpose |
| --- | --- |
| `sonara_customer_session` | Customer access token, 1 hour |
| `sonara_customer_refresh` | Customer refresh token, 30 days |
| `sonara_admin_session` | Administrator session |

```
grep -rhno 'res\.cookie("[a-z_]*"\|COOKIE = "[a-z_]*"' server.js lib/ routes/
```

No advertising cookie, no analytics cookie. PostHog appears in the tree only as
a provider-registry entry and a feature-flag record; it is not wired to collect
anything.

Device preferences (appearance, brightness, motion, sound, haptics) are held in
`localStorage` under `sonara.experience.v1` and never transmitted.

### Third parties that receive data

| Recipient | When | What it receives |
| --- | --- | --- |
| Supabase | Every authenticated request | Account, organisation, and module records |
| Vercel | Every request | Hosting; request metadata |
| Stripe | Checkout and billing | Payment identifiers. No card data or CVV is stored by SONARA |
| Resend | Transactional email, when configured | Recipient address and message |
| HaveIBeenPwned | Signup and password reset | The first five characters of a SHA-1 password hash — never the password, never the full hash |

Loading a page contacts no third party at all. The document requests fonts,
stylesheets, and scripts from this origin only — verified by rendering the page
and looking for any external host, which `tests/no-third-party-requests.test.js`
now does on every run.

### Data the product refuses to hold

Enforced in code, not only in policy: no raw card data, no CVV. Service-role
credentials are server-only and a client-secret scan runs on every release.

---

## 2. Findings — where the pages and the code disagree

### F-1. Google Fonts was an undisclosed recipient — RESOLVED

`lib/sonara-page-frame.cjs` loaded `fonts.googleapis.com` and `fonts.gstatic.com`
on every page, including public marketing pages, before any sign-in or consent
interaction, so every visitor's browser contacted Google and Google received
their IP address. The Data Processing page listed "Supabase, Vercel, Stripe,
Resend, and analytics providers" and did not mention Google.

Disclosing it was the interim step. It is now removed instead: the fonts are
served from this origin and the document makes no third-party request at all.
The disclosure has come back off both pages, because it is no longer true, and
keeping it would have been its own inaccuracy.

**There is nothing here for counsel to weigh any more.** A request that does not
happen needs neither disclosure nor a transfer basis.

Two things fell out of doing it, both recorded because they change the numbers
rather than the conclusion:

- Google served **one file per family**. The four Geist weights and the three
  Geist Mono weights were byte-identical, same URL. The `@font-face`
  declarations are unchanged, so rendering is the same.
- **Source Serif 4 was requested and never used.** `--sonara-font-serif` was
  declared in the design system and referenced by no rule and no markup
  anywhere. Dropping it removed 463 KB of the 743 KB self-hosting would
  otherwise have cost. Total shipped: 82 KB, latin and latin-ext only, which
  covers all five interface languages.

### F-2. A public security page carried an internal backlog item

`/legal/security-policy` stated: *"Admin routes require protected access and
should be replaced with full OAuth/session admin auth before broader operator
access."*

That is a to-do item, not a policy, and publishing it advertised a weakness in
the product's own administrative access. Replaced with a statement of the
control that exists. **The underlying engineering question — whether
administrative auth should be upgraded — is unchanged and still open.** The page
no longer announces it; that is not the same as it being resolved.

### F-3. Policy text says "should", not "does"

Several pages describe intentions rather than commitments — "Customer data
should be handled according to consent, retention, and organization access
controls", "Subprocessors should receive only the data needed". These read as
template scaffolding left in place.

Not changed here. Turning "should" into "does" is a commitment, and which
commitments to make is exactly the judgement being bought.

### F-4. Password floor was inconsistent between the two paths — RESOLVED

Signup accepted 8 characters while password reset required 12, so the stricter
rule was avoidable by signing up rather than resetting. Signup now matches reset
at 12.

Login deliberately keeps a lower floor. `handleEmailAuth` serves both signup and
login, and raising it for both would have refused the existing password of every
customer who set one between 8 and 11 characters — locking them out at the
sign-in screen, with no route through to the reset flow that would let them fix
it. A password already in use is not made safer by refusing to accept it. The
two floors are named constants and a test holds them apart.

### F-5. Supabase leaked-password protection is still disabled

The advisor reported it disabled on 2026-07-27 and it has stayed that way; the
deploy prints a warning every release. Application-level checking now runs at
signup and reset (`lib/sonara-leaked-password.cjs`), which covers the paths in
this repository but **not** every path Supabase Auth serves. The dashboard
toggle is owner-controlled and still off.

---

## 3. What counsel needs to decide

Grouped so the engagement can be scoped. Items in section 2 are the ones with a
known factual conflict; these are the open questions the pages cannot answer on
their own.

**Identity and jurisdiction**
1. Registered legal name, address, and service-of-notice address.
2. Governing law and forum.
3. Effective and last-updated dates, and how changes are notified.

**Money**
4. Whether the refund page matches the Stripe configuration actually in use.
5. Cancellation timing and what happens to saved records after cancellation.
6. Whether the quoted setup package — sold by quote, not self-serve checkout —
   needs separate terms.

**Data**
7. Controller and processor roles for organisation records.
8. Retention, deletion, and export commitments, and whether the product's
   current behaviour supports them.
9. Whether a DPA and the subprocessor list must be published rather than
   available on request.
10. Cross-border transfer basis, including F-1.

**Claims**
11. Whether the earnings, AI, and general disclaimers cover the marketing copy
    as written. Public copy avoids guarantees and avoids "AI" language by house
    rule, which narrows this but does not answer it.
12. Whether the accessibility page states a standard the product is held to.

**Conduct**
13. Whether acceptable-use covers synthetic media, voice cloning, and
    impersonation adequately for the creator tooling.
14. Whether the commercial-email page satisfies the regimes being sold into,
    given outreach is approval-gated and not automated.

---

## 4. What must not be claimed

Carried forward from `LEGAL_REVIEW_REQUIRED.md` and repeated because it governs
any rewrite: no guaranteed legal compliance, guaranteed security, guaranteed
uptime, guaranteed revenue, and no professional advice from the software.

Every legal page currently renders with a notice that qualified review remains
required and that the terms are not attorney-reviewed. **That notice should come
off only when it stops being true** — it is the one sentence on those pages that
is currently, verifiably accurate.
