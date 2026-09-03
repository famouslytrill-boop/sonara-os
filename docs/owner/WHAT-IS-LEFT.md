# How many steps are left

Written 12 August 2026. The honest answer is two numbers, because "completely
done" means two different things and only one of them is countable.

---

## Shipping what exists: 7 steps, all yours

The repository side is finished. There are no TODOs, no unimplemented paths, no
failing checks: the whole suite passes and the `verify:launch` chain is green
across all 41 commands. The test count is deliberately not written here
-- it changes every time anybody adds one, and a number typed into prose has
nothing watching it. `docs/HANDOFF_PROMPT.md` carries it and is generated.

**Green here does not mean shipped, and right now it does not.** Production has
been serving 5 August code since 5 August: every Controlled Production
Deployment since has failed, on a migration that cannot find a table production
is missing. That is step 8 in OWNER-STEPS.md, it is the first one to do, and none of the
checks above could see it -- they read this repository, and that is not where
the problem is.

The seven remaining steps are in `docs/owner/OWNER-STEPS.md`, written to be run
rather than interpreted:

| # | Step | Why it cannot be done here |
| --- | --- | --- |
| 1 | Buy a plan in production, once | Needs a real card on the live account |
| 2 | Turn on Supabase leaked-password protection, and set the env var that makes it a gate | Dashboard toggle; the MCP connection is read-only by contract |
| 3 | Export four authorization functions into version control | They exist in the live database and in no migration |
| 4 | Try one `EXECUTE` revoke on a preview branch | Needs a database you can afford to break |
| 5 | Make a private `sonara-uploads` bucket in Supabase Storage | A dashboard setting nothing here can read, and a public bucket would make every signed link pointless |

Nothing else is blocking a launch of what is built. `OWNER-STEPS.md` carries one
further item below those four, deliberately unnumbered because it blocks nothing:
asking HyperFormula's vendor for a price, which is the single open fact left from
the reciprocal-licence decision of 18 August 2026.

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

**Some of it cannot be built as stated.** Of 185 reviewed repositories, 23 carry a
reciprocal licence (AGPL/GPL/OSL/SSPL), which triggers on network use and so
reaches a hosted product; 11 declare no licence at all — which is not a review
item, it is an absence of permission — and 2 rest on n8n's fair-code Sustainable
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

Counted from the repository on 12 August 2026, not recalled.

- **248** registered GET routes
- **325** tables created by the migrations, **228** of them organization-scoped
- **23** owner record pages, **22** record checks
- **41** verification commands in the release chain
- **82** external repositories reviewed with their licences read off each one
- **0** modules under `lib/` or `routes/` that nothing references
- **0** tables created and never queried without a recorded decision
