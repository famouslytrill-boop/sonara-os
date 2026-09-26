# What you actually have to install

Review by: 2026-12-21

Short answer: **on your own machine, almost nothing.** Two command line tools,
and both optional — one only if you want to apply database migrations yourself,
the other only if you want Claude Code in your terminal.

Everything below was run in this repository on 19 August 2026 rather than
recalled, and the dependency counts, the Node major and the two hand-installed
tools were re-checked on 21 September 2026. Where something is unverified it
says so.

The review date above is three months out because that is roughly how long the
19 August figures lasted before two of them were wrong: this document said "one
production dependency" and "version 22" until 21 September, by which point
`package.json` declared nine dependencies and `engines.node` said `24.x`.
`pnpm run verify:dependency-claims` now fails the release if the count here
drifts again; the Node major and the tool versions are still prose, which is
what the date is for.

---

## The shape of this thing

It matters, because it changes what "install" means.

This is **an Express server in plain CommonJS**. There is no bundler, no
compile step, and no framework build. `pnpm run build` is
`node --check server.js && node -e "require('./server')"` — it parses the
server and loads it, and that is the whole build.

It has **nine production dependencies.** `express`, plus eight
`@opentelemetry/*` packages and `@openfeature/server-sdk` that arrived on
20 September 2026. Five development dependencies: `@playwright/test`,
`@vercel/node`, `eslint`, `mocha`, `supertest`.

That reads like a change to the paragraph above it and is not one. None of the
eight is a bundler or a compile step. As of 24 September 2026, the running
application **does call** the OpenTelemetry and OpenFeature-backed control-plane
modules: telemetry bootstrap runs before Express is loaded, HTTP observability
is installed afterwards, and the first event-consumer canary evaluates through
the runtime capability service. Export remains disabled without approved OTLP
configuration, so runtime wiring is not a claim that a telemetry backend is
live. It was one production dependency until 20 September; this document says
nine because nine is what `pnpm install` now fetches, not because the app gained
a compile toolchain.

So there is still no toolchain to install. If you have Node, you can run it.

---

## Running it on your own machine

You need two things, and you very likely have the first.

### 1. Node

**Get Node 24.** `package.json` declares `"engines": { "node": "24.x" }`, and
on Vercel that field *is* the production runtime rather than a preference —
`tests/the-runtime-ci-tests-is-one-production-may-run.test.js` fails if it
changes. Install anything older and every `pnpm` command prints
`WARN Unsupported engine: wanted: {"node":"24.x"}`, which is the one warning in
this repository worth acting on rather than reading past.

This document said "version 22 (`v22.22.2`)" until 21 September 2026, which was
true when it was written and had stopped being true. Get Node 24 from
<https://nodejs.org> — the LTS installer is fine.

Check it:

```
node --version
```

### 2. pnpm

`package.json` pins `pnpm@11.1.1` via the `packageManager` field, so the
cleanest way to get the right one is Corepack, which ships inside Node:

```
corepack enable
```

That is the whole install. Corepack reads the pinned version and fetches it the
first time you run `pnpm`.

**Do not use npm here.** `AGENTS.md` forbids it, and `package-lock.json` would
conflict with the lockfile every check in this repository reads.

### 3. Start it

From the repository folder:

```
pnpm install --frozen-lockfile
pnpm start
```

It prints `Listening on 5000` and serves on <http://localhost:5000>.

**The port is 5000, not 3000.** `server.js` reads `process.env.PORT || 5000`.
`.env.example` contains `PORT=3000`, which is where the older README's 3000
comes from — see the next section for why that file does nothing on its own.

Verified in this repository: `/` returns 200, `/pricing` returns 200,
`/business-builder` returns 200, and `/dashboard` returns 503. **The 503 is
correct** — it is the "setup required" state for a signed-in page with no
database configured. A blank local install is supposed to look like that.

---

## The one thing that does not work the way it looks like it does

**Copying `.env.example` to `.env` has no effect by itself.**

There is no `dotenv` in this project — the only production dependency is
`express`, and nothing reads a `.env` file at startup. So the old instruction
"copy `.env.example` to `.env`, then `pnpm start`" gets you a running server
with **none** of those variables set, which looks exactly like a working local
setup until you wonder why the database is not connected.

Node can load the file itself, with no dependency:

```
pnpm run dev
```

which is `node --env-file=.env server.js`. Verified: a `.env` containing
`PORT=3112` produced `Listening on 3112`.

If your `.env` does not exist yet:

```
cp .env.example .env
```

then fill in the values from the next section.

---

## The one tool you install by hand: the Supabase CLI

Only needed if **you** are the one applying database migrations. If you are not
touching the database, skip this.

It is deliberately not a dependency of this repository. The npm package pulls a
155 MB platform binary as an optional dependency, and Vercel runs
`pnpm install --frozen-lockfile` on every deploy — so adding it would put
155 MB on the critical path of every production build, for a tool a person runs
by hand a handful of times.

Install it whichever way suits your machine:

| Platform | Command |
| --- | --- |
| macOS or Linux, Homebrew | `brew install supabase/tap/supabase` |
| Windows, Scoop | `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase` |
| Anywhere, no installer | use `pnpm dlx supabase@latest` wherever this says `supabase` |

Check it:

```
supabase --version
```

`pnpm run db:push` now checks for it first and prints these instructions if it
is missing. Before this, it failed with
`[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "supabase" not found`, which
reads like a broken install rather than a tool nobody has installed — and four
documents in `docs/` tell somebody to run that command.

Then, from `docs/SONARA_DEPLOYMENT_TRUTH.md`:

```
supabase link --project-ref <your-project-ref>
supabase migration list
pnpm run db:push
```

Review `migration list` before pushing. This repository holds 134 migrations and
a push applies whatever is not yet applied.

---

## The other tool you install by hand: Claude Code

Optional, and a tool rather than part of the product. It is **not** a
dependency of this repository, it is not in `package.json`, and nothing in the
release chain needs it. Adding it to `package.json` would put it on the
critical path of every production build for something a person runs in a
terminal, which is the same reason the Supabase CLI is not in there either.

Read from the npm registry on 21 September 2026 rather than recalled: the
package is `@anthropic-ai/claude-code`, latest `2.1.278`, and its
`engines.node` is **`>=22.0.0`**. The Node 24 from the section above covers it.

**The installer that involves no package manager**, which is the one to prefer
here given `AGENTS.md`:

```
curl -fsSL https://claude.ai/install.sh | bash
```

On Windows PowerShell:

```
irm https://claude.ai/install.ps1 | iex
```

Both URLs redirect to `downloads.claude.ai`. The shell script installs
everything under `$HOME` and **refuses to run under `sudo`** — read on
21 September 2026, and worth knowing before you reach for it out of habit.

The package-manager route works too:

```
pnpm add -g @anthropic-ai/claude-code
```

`npm install -g @anthropic-ai/claude-code` is the form the upstream
documentation gives. Either is fine: `AGENTS.md`'s "use pnpm only" is about
**this repository's** dependency tree and lockfile, and a global CLI install
touches neither — but `pnpm add -g` keeps you from having npm in your shell
history at all, which is one less way to reach for the wrong one inside the
repository.

Then, from the repository folder:

```
claude
```

The first run opens a browser to sign in with your Claude account. Useful once
you are in:

| Command | What it does |
| --- | --- |
| `claude` | Start a session in the current folder |
| `claude --continue` | Pick up the last session in this folder |
| `claude doctor` | Check the install, auth and permissions |
| `claude update` | Update to the current version |
| `/help` | The command list, from inside a session |
| `/clear` | Start fresh without leaving |

Two things specific to this repository. `CLAUDE.md` and `AGENTS.md` load
automatically on every session, so the safety rules and the pointers to
`docs/HANDOFF_PROMPT.md` are in front of it before you type anything. And
`.claude/skills/` holds the working procedures — `checks-that-cannot-lie`,
`reviewing-an-outside-repository`, `researching-screenshot-tools` — which is
why a screenshot of a tool gets a licence read rather than an install.

**What it does not change.** It has no more authority than you give it:
`lib/sonara-agent-authority.cjs` still sends refunds, payout changes, legal
publishing, customer campaigns, proof publishing, security settings and
destructive data changes to you for approval, and an unknown action still
defaults to owner review. Merging and deploying stay yours.

---

## What you set up outside your machine

None of this is an install. It is four accounts and their settings, and it is
where the real work is.

`docs/owner/WHAT-MUST-BE-ON.md` is the authority on which variables are
required — it is checked by `pnpm run verify:env` on every release, so it
cannot drift from what the code reads. Ten variables are required. Without any
one of them a paying customer cannot be served.

| Service | What you do | Where the values go |
| --- | --- | --- |
| **Supabase** | Create the project. Apply the migrations. Enable email auth. | `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Stripe** | Create the products and prices. Point a webhook at `/api/stripe/webhook`. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the `STRIPE_PRICE_*` values |
| **Resend** | Verify the sending domain. | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Vercel** | Connect the repository. Put every variable above into Production. | `NEXT_PUBLIC_SITE_URL` |

**`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It bypasses row level security
entirely. It must never appear in a `NEXT_PUBLIC_*` variable or anywhere the
browser can read.

**`STRIPE_WEBHOOK_SECRET` is the one whose absence looks fine.** Checkout will
succeed, the customer will be charged, and the entitlement will never arrive.
Nothing on the outside looks wrong.

---

## The six things under `tools/`, and what each one costs you to run

Added 26 August 2026 and not covered by the sections above, which were written
on 19 August when none of them existed.

**None of these is part of the deployed application.** `vercel.json` bundles
`{public/**,routes/**,lib/**}` and nothing else, so nothing in `tools/` ships to
production, and none of it can break the site. They are separate programs that
live in this repository. You install something only if you want to run one.

| Directory | What it is | What you need | What it costs to run |
| --- | --- | --- | --- |
| `tools/songsmith` | Web app: a text idea becomes a song. Approval-gated accounts. | Node 24, and Docker if you want `docker compose up` | Free locally. **The generation backend is RunPod, and RunPod bills by the second.** Without a RunPod key it runs, takes requests and reports that generation is not configured. |
| `tools/agentkit` | Python toolkit for building single- and multi-agent systems, with a browser dev UI. | Python 3.11 or newer. Nothing else. | Free to run. A model key costs whatever that model charges — Gemini, or anything OpenAI-compatible. With no key the scripted client runs the tests. |
| `tools/aws-emulator` | Local AWS on one port. S3, DynamoDB, Lambda, SQS. | Node 24, or Docker | Free. No account, no auth token, no paid tier. |
| `tools/serverless-cli` | Define Lambda functions in YAML, see what a deploy would change before it changes. | Node 24 | Free locally. Deploying costs whatever AWS charges. |
| `tools/voice-clone` | Upload a voice with recorded consent, type text, get audio in that voice. | Python, `make`, and a GPU for the real engine | Free. **Runs immediately without having cloned anything** — read "Two engines" in its README before assuming otherwise. |
| `tools/disposable-domains` | The tooling that keeps `lib/sonara-disposable-domains.txt` correct. | Nothing | Free. The list it maintains *is* used by the deployed application. |

Every one of them has **zero dependencies** by deliberate policy: `node:sqlite`,
`node:crypto`, `node:http`, `urllib`, `json`, `http.server`. Each has a test
that fails if a non-standard-library import appears, so the claim cannot rot
quietly. That is why "install" for five of the six is "have Node, or have
Python".

### If you only want to try one

```
cd tools/agentkit && python3 -m unittest discover -s tests -v
```

Python 3.11+ and nothing else. It runs 69 tests and needs no key, no account and
no network.

**Run it with `-v`, and check a number came out.** `python -m unittest discover`
exits 0 when it discovers nothing at all, so a silent green here means "no tests
failed", not "the tests passed". That is the single most useful habit in this
repository, in miniature.

---

## Optional local open-source adapter stack

If you explicitly want the self-hosted adapter software, use
`docs/owner/OPEN-SOURCE-LOCAL-STACK.md`. The repository now has one bounded
local orchestration path: `pnpm run open-source:up` starts the reviewed core
services on loopback only, while `pnpm run open-source:up:reviewed` adds the
separately reviewed Open WebUI profile. The setup helper generates local-only
secrets and can write the matching `SONARA_*` adapter variables into `.env`.

This does **not** make a laptop reachable from Vercel production, and it does
not turn optional software into a launch dependency. Dify, RAGFlow, n8n,
whisper.cpp and the consent-gated voice-clone engine remain separately managed
because their licence, data, infrastructure, model, or consent boundaries need
an explicit owner decision.

## What you do not have to install for the application to work

The application names optional service adapters including Ollama, Langflow, Open
WebUI, Crawl4AI, Dify and RAGFlow. **Every one of them is off, and the product
is complete without them.** Each degrades to a stated "setup required" rather
than an error, and the release checks enforce that none may become a launch
dependency.

If you install one on your laptop, the deployed application still cannot reach
it. `docs/architecture/EXTERNAL-SERVICES.md` is the long version; the short
version is that `http://localhost:11434` means "this serverless function",
which is a machine in a datacentre that has no Ollama on it. Running one of
these usefully means hosting it somewhere with a public address, which is a
server you pay for.

The record checks, the money figures and the chase drafts are ordinary
arithmetic over your own rows. No engine, no service, no key.

---

## The order to do it in

1. `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm start`. Confirm
   the public pages open and the signed-in pages say setup required. This
   proves your machine is fine before any account is involved.
2. Create the Supabase project, install the CLI, apply the migrations.
3. Fill in `.env`, run `pnpm run dev`, and confirm sign-up works locally.
4. Create the Stripe products and the webhook.
5. Verify the Resend sending domain.
6. Put every variable into Vercel Production and deploy.
7. `docs/owner/OWNER-STEPS.md` item 1: buy a plan in production, once. That is
   the only thing that proves the checkout, webhook and entitlement path works
   end to end, and nothing in this repository can do it for you.

## How to check you have not missed a variable

```
pnpm run verify:env
```

It reads every `process.env` reference in the source, requires each name to be
classified, and fails in both directions — a variable the code reads with no
classification, and a classification for a variable nothing reads.
