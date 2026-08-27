# What you actually have to install

Short answer: **on your own machine, almost nothing.** One command line tool,
and only if you want to apply database migrations yourself.

Everything below was run in this repository on 19 August 2026 rather than
recalled. Where something is unverified it says so.

---

## The shape of this thing

It matters, because it changes what "install" means.

This is **an Express server in plain CommonJS**. There is no bundler, no
compile step, and no framework build. `pnpm run build` is
`node --check server.js && node -e "require('./server')"` — it parses the
server and loads it, and that is the whole build.

It has **one production dependency: `express`.** Four development
dependencies: `@vercel/node`, `eslint`, `mocha`, `supertest`.

So there is no toolchain to install. If you have Node, you can run it.

---

## Running it on your own machine

You need two things, and you very likely have the first.

### 1. Node

Version 22 is what this was verified on (`v22.22.2`). Get it from
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

Node 22 can load the file itself, with no dependency:

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

Review `migration list` before pushing. This repository holds 103 migrations and
a push applies whatever is not yet applied.

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
| `tools/songsmith` | Web app: a text idea becomes a song. Approval-gated accounts. | Node 22, and Docker if you want `docker compose up` | Free locally. **The generation backend is RunPod, and RunPod bills by the second.** Without a RunPod key it runs, takes requests and reports that generation is not configured. |
| `tools/agentkit` | Python toolkit for building single- and multi-agent systems, with a browser dev UI. | Python 3.11 or newer. Nothing else. | Free to run. A model key costs whatever that model charges — Gemini, or anything OpenAI-compatible. With no key the scripted client runs the tests. |
| `tools/aws-emulator` | Local AWS on one port. S3, DynamoDB, Lambda, SQS. | Node 22, or Docker | Free. No account, no auth token, no paid tier. |
| `tools/serverless-cli` | Define Lambda functions in YAML, see what a deploy would change before it changes. | Node 22 | Free locally. Deploying costs whatever AWS charges. |
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

## What you do not have to install, and should not

The application names six optional service adapters: Ollama, Langflow, Open
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
