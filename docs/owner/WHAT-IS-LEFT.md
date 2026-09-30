# How many steps are left

Updated: 2026-09-27

## Current production status

PR [#373](https://github.com/famouslytrill-boop/sonara-os/pull/373) is merged to
`main` at `9a105da6abc0e46aff170bebf690de80dc957886`. Controlled Production
Deployment run #248 completed successfully. Vercel deployment
`dpl_7YKcMPxTLwTt7FCNsPijrtsrWMVR` is **READY** for production, and
https://sonaraindustries.com serves that exact commit.

The live smoke test passed 282 assertions: `/api/health` returned the exact
commit, readiness reported configured providers, public pages loaded, and a
customer-only route correctly required authentication. Production Google
sign-in configuration and Stripe price configuration passed the release
checks. Supabase reported that the remote database was up to date, so this
release applied no migrations and changed no production schema or data.

The release adds a generated route/schema/capability inventory, refreshes the
verified pnpm toolchain, and hardens deterministic security tests and report
escaping. It does **not** implement every product, industry, or service named
in the original request. The inventory is source-level evidence; it does not
prove every listed feature is live, every production table is populated, or
every user journey works. See
[the coverage inventory](../CAPABILITY_ROUTE_SCHEMA_COVERAGE.md) and
[the 2026 market and platform research](../research/PLATFORM_COMPLETENESS_AND_MARKET_CONVERGENCE_2026-09-25.md)
for the verified scope and follow-up gaps. There are no open pull requests in
the repository as of this update.

## Manual owner actions

These actions require your accounts, payment method, or explicit business
decision:

1. **Make the repository private, if that remains your choice.** It is currently
   public. In GitHub open **Settings → General → Danger Zone → Change
   repository visibility → Private**, then confirm the repository name. See
   [GitHub's visibility instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
2. **Prove one real customer checkout and entitlement.** The release verified
   live price configuration, but did not use a real customer card or prove a
   persisted entitlement. Use a card you control and refund/cancel the proof
   transaction if appropriate.
3. **Review the owner-controlled settings in
   [OWNER-STEPS.md](OWNER-STEPS.md)** against the live dashboards before
   changing them. The release does not establish the current state of leaked
   password protection, preview-only RLS experiments, the private upload
   bucket, or Stripe Connect.
4. **Share any personal ChatGPT workspace material manually.** This workspace
   has no connector to your personal ChatGPT workspaces. Export or copy only
   the material you want included; private workspace contents were not read.
5. **Local setup:** follow [the step-by-step owner setup guide](SETUP-STEP-BY-STEP.md)
   and the commands in the final response. These steps are optional for the
   already deployed production release.

Dated production diagnoses later in this file are retained as history. Their
older claims about a stale deployment, missing prices, failed migrations, or
pending owner actions are superseded by the 27 September run #248 evidence
above; do not repeat an old remediation without fresh live evidence.

---

## Building everything discussed: not a number, and here is why

The larger scope — roughly forty named product surfaces, "all pages in advanced
3D", every reviewed repository installed, the application fully autonomous — has
no step count, and quoting one would be the most misleading thing in this
document.

Three reasons, each checkable rather than an opinion.

**The list is open.** Forty surfaces was the count in one message. Restaurant
management, scheduling, project management, logbooks, memos, hiring, public
channels, feeds, note-taking, book writing, podcasts, streaming, DAW workflows,
MIDI, film theory, voice modulation, catering, RSVP, venues, concerts, maps,
tickets, presentations. Each of those is a product, not a page. Any number I
gave would be a number for my interpretation of them.

**Some of it cannot be built as stated.** Of 269 reviewed repositories, 36 carry a
reciprocal licence. Of those, 18 are network-triggered, 15 trigger on
distribution, and 3 are custom or qualified enough that the individual record
must be read; 18 declare no licence at all — which is not a review item, it is
an absence of permission — and 2 rest on n8n's fair-code Sustainable
Use Licence, which permits internal use but restricts offering it as a hosted
service. "Install all repositories" has no completion state that is also legal.

**Part of it contradicts the rest of it.** "Fully autonomous with very little
human intervening" and `AGENTS.md`'s seven owner-approval categories are both
your instructions. The second is implemented in `lib/sonara-agent-authority.cjs`
and enforced on every release. I have built toward the version where everything
outside those seven runs unattended and records itself, which is the largest
autonomy those two sentences allow together.

## What a real answer looks like instead

Pick the next surface and it becomes countable. The last five were, and each
took one sprint: accounts receivable, money due in and out, invoice line items,
quote to invoice, chase drafts. Every one of them was countable because it was
one job for one kind of business, with a table under it.

The pattern that worked: name the job, check what the schema already holds,
build the smallest honest version, and let the release gates find what was
missed. On those five they found ten real defects, including a form that could
never save and two POST handlers silently sharing one path.

## What has been built, in numbers

Counted from the repository, not recalled — and now *kept* counted, which the
heading previously only promised. This block was written on 12 August 2026, and
by 15 September four of its figures had drifted: the route count was low by
fifty-nine, the register count was low by a hundred and fifty-five, and the
owner-page count was low by four. `docs/SHIP_READINESS.md` carried the route
figure as well and was stale by thirty — one fact, two documents, two different
wrong values, which is what a hand-typed number looks like a month later.

The drift amounts are spelled as words on purpose. Written as digits beside the
phrases below they would be read as fresh claims by the very check that now
guards them, and a check that fires on a true sentence gets reworded around
rather than fixed.

Each of the figures below except the last is now derived by
`scripts/verify-doc-counts.mjs` and fails the release chain if it drifts again.

- **313** registered GET routes
- **345** tables created by the migrations, **247** of them organization-scoped
- **28** owner record pages
- **66** verification commands in the release chain
- **269** external repositories reviewed with their licences read off each one
- **0** modules under `lib/` or `routes/` that nothing references
- **0** tables created and never queried without a recorded decision
- **22** record checks — **hand-counted on 12 August 2026 and not derived.**
  Unlike the others, "record check" names no single thing a script can count, so
  it is left alone rather than guessed at: the check's own rule is that only
  counts derivable *exactly* belong to it, and a judgement recorded at review
  time is deliberately a human's. Treat this one as a figure to re-measure, not
  as a guarded one.
