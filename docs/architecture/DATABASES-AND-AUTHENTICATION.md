# Databases and authentication this application could move to

Checked: 2026-08-19
Review by: 2027-02-19

Every licence below was read from the project's own `LICENSE` file on
19 August 2026, not recalled. Two of them are not what this author expected,
and both are named as corrections rather than quietly listed right.

---

## The finding that should shape the decision

The obvious assumption is that authentication is easy to replace and the
database is not. **Measured against this repository, the coupling is the other
way round in size and the same way round in difficulty — and the numbers are
worth having before anybody plans a migration.**

| Surface | Files that touch it | What is actually used |
| --- | --- | --- |
| Supabase Auth | **2** | Four endpoints: `/auth/v1/user`, `/token`, `/signup`, `/recover` |
| PostgREST | **27** | 145 tables, 3 stored procedures |
| Supabase Storage | **2** | Signed object URLs |

`lib/sonara-customer-auth.cjs` is 426 lines and is where nearly all of the auth
coupling lives. Four HTTP endpoints is a small enough surface that swapping the
provider behind them is a week of work, not a quarter.

The database is the opposite, and the reason is not the row count:

**This application does not depend on Supabase. It depends on PostgREST.**

Every read and write is an HTTPS request to `/rest/v1/<table>?<filter>` with a
service-role key. PostgREST is a separate open-source project (PostgreSQL
licence) that Supabase runs; it is not Supabase's invention and not Supabase's
to withdraw. That single fact decides most of what follows, because it means the
cheap move is **any Postgres with PostgREST in front of it**, and every other
database on the list is a rewrite of 27 files regardless of how good it is.

---

## What the choice is actually constrained by

Three constraints, in the order they eliminate candidates.

**1. It has to be reachable from a serverless function.**
`docs/architecture/EXTERNAL-SERVICES.md` sets this out in full: this application
deploys to Vercel as serverless functions, and a function cannot reach a service
on somebody's laptop. Anything here is either a hosted endpoint or something the
owner runs somewhere with a public hostname.

**2. An in-process database is not an option, and this is not obvious.**
SQLite, DuckDB and PGlite are excellent and all three are ruled out for the same
reason: a serverless function's filesystem is ephemeral and per-instance. Two
concurrent requests are two containers with two different copies of the file, and
one of them loses. They are ruled out by the deployment model, not by quality —
which is why they are listed and refused rather than omitted.

**3. A free tier is a price, not a licence.**
`CLAUDE.md` states this and it is the rule that matters most here. Supabase, Neon
and Turso all have free tiers. A shipped feature resting on one stops working
when the tier changes, and that is the vendor's decision, not this project's. The
licence column below says what nobody can take away; the free tier says what is
free *today*.

---

## Databases

| Project | Licence (read 19 Aug 2026) | Reciprocal? | Verdict here |
| --- | --- | --- | --- |
| **PostgreSQL** | PostgreSQL Licence | No | The thing underneath. Not a decision. |
| **PostgREST** | PostgreSQL Licence | No | **The actual dependency.** Runs against any Postgres. |
| **Supabase** | Apache-2.0 | No | Self-hostable in full. The exit exists and is boring. |
| **Valkey** | BSD-3-Clause | No | Redis fork under the Linux Foundation. The safe cache. |
| **Redis** | AGPLv3 / SSPLv1 / RSALv2 | **Yes (AGPL)** | Tri-licensed since 8.0. Valkey is the same thing without the question. |
| **Appwrite** | BSD-3-Clause | No | Whole platform, not a library. Would replace the stack, not join it. |
| **PocketBase** | MIT | No | Single Go binary with SQLite inside. Ruled out by constraint 2. |
| **Nhost** | MIT | No | Postgres + Hasura. A GraphQL rewrite of 27 files. |
| **DuckDB** | MIT | No | Analytics, in-process. Ruled out by constraint 2. |
| **libSQL / Turso** | MIT | No | SQLite fork with a network protocol. A real option, and a rewrite. |
| **PGlite** | Apache-2.0 | No | Postgres compiled to WASM. Ruled out by constraint 2. |
| **Directus** | **MSCL-1.0-GPL** | **Yes** | ⚠️ **Correction.** See below. |
| **MongoDB** | SSPLv1 | **Yes** | Not OSI open source. Different data model entirely. |

### Two corrections to what this author believed

**Directus is no longer BSL, and is no longer open source in the OSI sense.** Its
`license` file is the *Monospace Sustainable Core License, Version 1.0*
(`MSCL-1.0-GPL`), copyright 2026 Monospace Inc. This is a licence written this
year, and its abbreviation carries `GPL`. Anything built on Directus needs the
full text read by somebody qualified before a line is written, not a summary from
a table — including this one.

**Redis is tri-licensed, not source-available-only.** Since Redis 8.0 (May 2025)
you may take AGPLv3 instead of SSPLv1 or RSALv2. AGPLv3 is OSI-approved, so
"Redis is not open source any more" is out of date. It is still the reciprocal
choice, and Valkey (BSD-3-Clause, Linux Foundation, forked April 2024 with AWS,
Google and Oracle behind it) is the same capability with none of the question —
which is why the recommendation is Valkey and not Redis, on licence rather than
on merit.

---

## Authentication

Only four endpoints are in use, so the bar is low and the field is wide.

| Project | Licence (read 19 Aug 2026) | Reciprocal? | Notes |
| --- | --- | --- | --- |
| **Keycloak** | Apache-2.0 | No | CNCF. The heavyweight, and the safest licence in the list. |
| **Ory Kratos** | Apache-2.0 | No | API-first, no UI of its own — which suits a server-rendered app. |
| **Casdoor** | Apache-2.0 | No | Single Go binary, UI included. |
| **SuperTokens** | Apache-2.0 | No | Core is Apache-2.0; some features are in a paid tier. |
| **Authelia** | Apache-2.0 | No | A gateway in front of services, not a user store for an app. |
| **Better Auth** | MIT | No | A TypeScript library, not a service. See the note below. |
| **authentik** | **MIT core, mixed** | Partly | ⚠️ Split licence. See below. |
| **Logto** | **MPL-2.0** | **Yes, per file** | Reciprocity attaches to the file, not the product. |
| **Zitadel** | **AGPLv3** | **Yes, on network use** | ⚠️ **Correction.** See below. |
| **FusionAuth** | Proprietary | n/a | Free tier, not a free licence. Constraint 3 applies. |

### Three that need reading rather than listing

**Zitadel is AGPLv3, not Apache-2.0.** This author would have said Apache-2.0
from memory and would have been wrong — which is the entire reason
`data/open-source-tools.ts` exists and why licences here are read rather than
recalled. AGPL triggers on network use, and this is a hosted product.

There is a distinction that matters and that this document will not settle: the
AGPL's source obligation attaches to *the AGPL work* — modifying Zitadel and
letting users interact with it over a network obliges offering Zitadel's source.
Running an unmodified Zitadel as a separate service and calling its HTTP API from
this application is a different arrangement, and the usual reading is that it
does not make this application a derivative work. **That is a legal question, not
an engineering one.** It goes to counsel before anybody builds on it, and it is
recorded here as an open question rather than as an answer.

**authentik is not one licence.** Its `LICENSE` file splits the repository:
`website/` is CC BY-SA 4.0, `authentik/enterprise/` is under its own separate
licence, client-side JavaScript is MIT Expat, and everything else is MIT. "MIT"
is true of the core and false of the whole, and a table that said "MIT" without
this paragraph would be the kind of claim that reads like a verified fact.

**Logto is MPL-2.0, which is reciprocal per file.** MPL's obligation follows the
individual file: modify a Logto file and that file's source must be offered.
Using it unmodified as a service creates no such obligation. That is a much
narrower obligation than AGPL's and a wider one than MIT's, and the difference is
worth knowing before somebody patches a file to fix something small.

**Better Auth is a library, not a service, and this stack cannot use it as-is.**
It is TypeScript for the Node ecosystem and would be the natural choice on almost
any other JavaScript project. This one has **one production dependency** —
`express` — no bundler and no build step (`pnpm run build` is
`node --check server.js && node -e "require('./server')"`). Adding a TypeScript library means adding a compile
step, which is a larger change to how this repository works than swapping an auth
provider. Not a licence problem; an architecture one.

---

## What this suggests doing, in order

1. **Nothing, for now.** The incumbent is Apache-2.0 and self-hostable, the exit
   is PostgREST rather than Supabase, and no constraint is currently binding.
   Migration is a cost paid against a problem, and there is no problem yet.
2. **When a cache is needed, reach for Valkey, not Redis.** Same capability, BSD,
   no licence conversation.
3. **If auth ever has to move, price it at four endpoints.** Keycloak, Ory Kratos
   or Casdoor — all Apache-2.0, all with a service boundary this application
   already speaks over. The cost is in `lib/sonara-customer-auth.cjs` and nowhere
   else.
4. **Do not plan a database move as a database move.** Plan it as *keeping
   PostgREST and changing what is underneath it*, which is a configuration
   change, or as *rewriting 27 files*, which is a quarter. There is no third
   option, and treating a database swap as a like-for-like is how the second one
   gets started while the first was budgeted.

---

## What was not checked

- **No repository here was cloned, imported or run.** These are licence readings
  and a reachability analysis, not evaluations.
- **Performance was not measured**, for anything, at all. Nothing above ranks on
  speed and no sentence here should be read as if it did.
- **Free-tier limits were not recorded**, deliberately. They change without
  notice, and a figure in this file would be wrong before it was read. The rule —
  a free tier is a price — is what belongs here; the numbers belong on the
  vendor's page on the day somebody needs them.
