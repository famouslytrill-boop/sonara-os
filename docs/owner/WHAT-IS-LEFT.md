# How many steps are left

Updated: 2026-10-07

Review by: 2026-11-14

## The last release checked against production

This section is the evidence from one release, verified on 27 September 2026 and
not re-checked since. It is **not** a statement about what production serves
today, and it read as one until 1 October 2026 — present tense, no date in the
sentences, at the top of the document somebody opens to find out where things
stand. The commit named below is no longer the head of `main`; releases have
merged since, and nobody re-ran the live smoke test against them. Whether
production is serving one of those is deliberately not asserted here, because
asserting it would need somebody to go and look.

The date above is what makes the `Review by:` line at the top of this file do
anything. `scripts/report-stale-claims.mjs` reads a review date only on documents
that say when they checked something, so a review date on a document with no such
sentence is a promise nothing enforces — which is the defect this repository keeps
finding. Said plainly rather than left implicit, because the sentence carrying the
date now looks like prose and is load-bearing.

PR [#373](https://github.com/famouslytrill-boop/sonara-os/pull/373) was merged to
`main` at `9a105da6abc0e46aff170bebf690de80dc957886`. Controlled Production
Deployment run #248 completed successfully. Vercel deployment
`dpl_7YKcMPxTLwTt7FCNsPijrtsrWMVR` was **READY** for production, and
https://sonaraindustries.com served that exact commit.

That release's live smoke test passed 282 assertions: `/api/health` returned the
exact commit, readiness reported configured providers, public pages loaded, and a
customer-only route correctly required authentication. Production Google
sign-in configuration and Stripe price configuration passed the release
checks. Supabase reported that the remote database was up to date, so this
release applied no migrations and changed no production schema or data.

That release added a generated route/schema/capability inventory, refreshed the
verified pnpm toolchain, and hardened deterministic security tests and report
escaping. It does **not** implement every product, industry, or service named
in the original request. The inventory is source-level evidence; it does not
prove every listed feature is live, every production table is populated, or
every user journey works. See
[the coverage inventory](../CAPABILITY_ROUTE_SCHEMA_COVERAGE.md) and
[the 2026 market and platform research](../research/PLATFORM_COMPLETENESS_AND_MARKET_CONVERGENCE_2026-09-25.md)
for the verified scope and follow-up gaps.

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

**Some of it cannot be built as stated.** Of 270 reviewed repositories, 36 carry a
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

- **310** registered GET routes
- **381** tables created by the migrations, **280** of them organization-scoped
- **28** owner record pages
- **77** verification commands in the release chain
- **270** external repositories reviewed with their licences read off each one
- **0** modules under `lib/` or `routes/` that nothing references
- **0** tables created and never queried without a recorded decision
- **27** record checks

This list no longer has a hand-counted figure in it. The last one was the record
checks, carried as **22** and described as not derivable because "record check"
named no single thing a script could count. That was wrong, and the figure had
drifted to 27 underneath it: `lib/sonara-record-checks.cjs` exports `CHECKS`, a
declared array, and it is the one source both the runtime and
`tests/record-checks.test.js` read. It is now derived by
`scripts/verify-doc-counts.mjs` like the rest, and that check was watched failing
on the old number, naming the file and both figures, before being trusted.

The stale figure appears above as a bare number and nowhere beside the words it
counted. That is deliberate: this paragraph is inside the population the new
check reads, so writing the old figure next to the noun phrase would make the
sentence itself a claim the check fails on. It did, on the first draft.

Worth keeping, because the failure is subtler than a stale number: the sentence
did not claim 22 was right, it claimed the quantity was **unmeasurable**. A figure
excused from measurement is not a figure anybody re-measures. That is an expired
exemption one level up — the reason was never true, rather than having stopped
being true.
