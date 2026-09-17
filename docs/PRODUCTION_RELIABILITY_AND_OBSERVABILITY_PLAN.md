# Production Reliability and Observability

Review by: 2026-12-17

The phase after the production cutover. Recorded 17 September 2026 at the
owner's direction, in their framing: *"Once this production cutover is green,
the next major engineering phase should be Production Reliability &
Observability."*

**This is a plan, not a status.** Every item below says what already exists and
what does not, because half of them are partly built and reading the list as
nine empty boxes would mean rebuilding things that work. Each "absent" line was
checked against the repository on 17 September 2026 rather than assumed.

## The gate this phase waits behind

The owner's other half of that instruction: *"the engineering bottleneck is no
longer general code quality — it is the single protected Stripe runtime
credential boundary."*

That is correct and it is documented: `production-commit-drift.yml` records that
*"every deploy run since 5 August had failed, the newest of them at a single
step, an empty `STRIPE_RUNTIME_SECRET_KEY`."*

What changed on 17 September is **when** that gate speaks, not what it accepts.
The credential precondition is now the first step in the job, so the failure
arrives in seconds with a named cause instead of after a full release chain.
Supplying the secret is still the owner's, and is
[`docs/owner/STRIPE-RUNTIME-KEY-CUTOVER.md`](owner/STRIPE-RUNTIME-KEY-CUTOVER.md).

## 1. Structured logs

**Started 17 September 2026.** `lib/sonara-structured-log.cjs` is the emitter:
one JSON line per event, carrying the tenant, the capability, the outcome and a
correlation id. No dependency added.

**Wired:** `lib/growth-studio-dispatch.cjs`, which was the module the old
paragraph here named as the pattern to follow. It now emits one terminal
`campaign.dispatch` event per send, plus a `campaign.dispatch.degraded` event
per named degradation. The prose lines are unchanged and still go out beside
them — structured logging that replaced the readable line would make one
incident harder to read in exchange for making a hundred countable.

**Three design decisions that exist to keep the count honest:**

- **The outcome set is closed** — `ok | partial | refused | degraded | failed`.
  Free text is the defect: "failed", "failure", "error" and "Failed." are four
  values naming one thing, and a rate over them is wrong invisibly. `partial`
  is its own member because a campaign where 459 of 460 landed is neither a
  success nor a failure. `refused` is separate from `failed` because a gate
  saying no is this code working, and counting it against an error budget would
  make the budget measure configuration rather than reliability.
- **`scope` is required** — `organization` (with an id) or `process`. Without
  it a forgotten tenant and a genuinely tenant-less event both read as
  `organization: null`, which is shape 4: absent and deliberately-none are
  different facts with the same shape.
- **Redaction is field-wise, before serialisation, and that is forced rather
  than chosen.** Running the redactor over serialised JSON *corrupts it*:
  `authorization_header` and `assigned_secret` in `lib/sonara-redaction.cjs`
  both match an optional closing quote and replace with `$1: [redacted…]`
  without restoring it, so the quote is eaten and a second colon appears.
  `tests/redaction-boundary.test.js` runs all eight of its secret shapes
  through the emitter and asserts both that the secret is gone and that the
  line still parses.

**Also wired: the checkout path** (`lib/sonara-billing.cjs`), 17 September 2026.
`checkout.session` and `checkout.customer` events across created, refused and
failed.

Instrumenting it turned up a defect rather than just adding a line.
`createStripeCheckoutSession` named every refusal it made itself --
`price_mismatch`, `price_product_archived` -- and returned **bare
`{ ok: false }` with no code** when Stripe rejected the session. So the customer
saw "Checkout could not be started" and the server kept no record of why: a 401
from a key that cannot create sessions was indistinguishable from a 400 on bad
parameters and from the network not answering.

That is precisely the failure
[`docs/owner/STRIPE-RUNTIME-KEY-CUTOVER.md`](owner/STRIPE-RUNTIME-KEY-CUTOVER.md)
warns about — *"a verifier restricted to Prices/Products read access can make
the price audit pass while every customer/Checkout Session write fails"* — and
the documented failure mode had no diagnostic. It now returns
`stripe_session_rejected` with the HTTP status, and the event attributes 401/403
to the credential, any other status to the request, and no status to the
network.

The Stripe-customer mapping write was also `.catch(() => undefined)` with the
result discarded. Losing it does not produce a missing row, it produces a
**second Stripe customer**: the lookup is what prevents one, so an absent
mapping makes the next checkout create another for the same person. The checkout
still proceeds and still returns ok — the customer Stripe just created is real
and refusing would turn a bookkeeping failure into a lost sale — but it now
emits `degraded` naming that consequence.

**Still absent:** the agent runner, and every other caller. Eight console calls
exist in the runtime tree; two modules now emit events beside their prose.

## 2. Traces

**Absent entirely, and the previous claim that it was configured was false.**
`docs/MONITORING_AND_BACKUPS.md` said OpenTelemetry placeholders existed through
`OTEL_EXPORTER_OTLP_ENDPOINT`. That name is read by no code and is not in the
registry `verify:env` checks; it appeared in that document and nowhere else.
Corrected 16 September 2026.

**Constraint that shapes this:** a serverless function cannot hold a socket
open, and the documented duration is 300 seconds. A trace exporter that batches
in the background loses the batch when the invocation ends, so export has to be
synchronous-before-response or through a collector the function posts to once.

## 3. Service level objectives

**Absent.** Nothing states a target for any surface, so nothing can be
measured against one.

**Prerequisite:** item 1. An SLO over unstructured logs is a number somebody
maintains by hand, which is the defect
`.claude/skills/checks-that-cannot-lie` exists to catch.

**Start narrow:** the two paths where failure is already understood and costly
— checkout session creation, and campaign send acceptance. Both already report
per-attempt outcomes.

## 4. Error budget alerts

**Absent,** and it is gated on item 3: an error budget is arithmetic over an
SLO.

**AGENTS.md constrains the delivery:** *"Sounds, voice announcements, haptics,
SMS, push, and email alerts must be off or explicitly user-controlled by
default."* So an alert is a surface the owner opts into, not a default
notification. Push subscriptions already exist as a table with that posture.

## 5. Queue and retry telemetry

**Exists, per attempt, in two places.** `lib/growth-studio-dispatch.cjs` bounds
its fallback at `MAX_FALLBACK_BATCHES` and reports the recipients past that
bound as **not attempted** rather than attempted and untracked.
`public.growth_campaign_sends` (added 16 September 2026) records one row per
recipient across accepted, failed and not-attempted, and
`lib/growth-studio-send-records.cjs` answers "who still has not been reached"
from it while refusing to answer from a failed read.

**Absent:** the >1,000-recipient cross-invocation queue. It needed that record
and now has it, but it also needs the work to be resumable across invocations,
which is the real remaining piece. A campaign over
`MAX_RECIPIENTS_PER_SEND` is currently refused outright with
`too_many_recipients`.

**Also absent:** any aggregate view. The rows exist per campaign; nothing
summarises retry rates across them.

## 6. Webhook observability

**Exists, and more than the list implies.** `/api/webhooks/stripe` and
`/api/stripe/webhook` both route to `handleStripeWebhook`, audit rows land in
`billing_webhook_events`, and `/admin/webhooks` reads them back with the
explicit statement that failed payment events are recorded for review and do
**not** unlock paid access.

**Absent:** delivery-lag and retry-exhaustion visibility. The rows say what
arrived; nothing says what Stripe tried to deliver and could not.

## 7. Backup and restore drills

**This is the weakest item in the phase and it has an owner dependency.**

**Exists:** a schema-only checkpoint before every migration, with the restore
target timestamp and the previously-live commit recorded to the job summary,
plus [`docs/PRODUCTION_ROLLBACK_RUNBOOK.md`](PRODUCTION_ROLLBACK_RUNBOOK.md).

**Absent:** any backup script or workflow at all — the three named in the old
`MONITORING_AND_BACKUPS.md` existed only under `archive/`. Storage objects are
covered by nothing in this repository. No restore has ever been rehearsed.

**Blocked on the owner:** whether Supabase point-in-time recovery is enabled is
not visible from the source tree, and the entire data half of the runbook
depends on it. `OWNER-STEPS.md` item 9. **A drill cannot be designed before that
answer, because the procedure differs completely depending on it.**

## 8. Deployment rollback automation

**Exists:** the checkpoint that makes a rollback possible, a failure step that
surfaces rollback instructions, and a runbook with five ordered steps including
the distinction between a reversible and a destructive migration.

**Absent:** the automation. Every step is currently performed by a person
reading the runbook.

**Sequencing:** item 7 first. Automating a rollback whose data half has never
been rehearsed automates a procedure nobody has confirmed works.

## 9. Owner-facing operations dashboard

**Exists in part.** `/owner/agent-activity` is the read side of every gated
agent run, `/owner/agent-schedule` covers scheduled work, `/admin/webhooks`
covers payment events, and `/api/health` reports the live deployment's commit.

**Absent:** one place that answers "is the business running well right now".
The pieces are per-subsystem and a reader has to know which page to open.

**Depends on:** items 1, 3 and 5. A dashboard over unstructured logs and no
SLOs would be a page of counts with nothing to compare them against — which is
how a green dashboard comes to sit over a broken system.

## Ordering

The dependencies above are not preferences. In order:

1. **Structured logs** (item 1) — everything measurable depends on it. The
   emitter exists and the campaign dispatcher emits; the remaining work is
   callers, not design.
2. **The PITR answer** (owner step 9) — unblocks item 7, and it is two minutes.
3. **Backup and restore drill** (item 7), then **rollback automation** (item 8).
4. **SLOs** (item 3), then **error budgets** (item 4).
5. **Traces** (item 2) and **queue aggregates** (item 5) alongside the above.
6. **The dashboard** (item 9) last, because it reports on all of them.

## What this phase must not do

Add a production dependency without an explicit architecture decision. This
application has **one** — `express` — and that is why the client-secret scan,
the audit gate and the reciprocal-licence check can all say something definite.
An observability SDK is the most likely thing to change that, and
`docs/architecture/EXTERNAL-SERVICES.md` sets the four rules an adapter has to
follow before it is written.

A hosted observability service with a free tier is a price, not a licence: a
shipped feature resting on one stops working when the tier changes, and that is
the vendor's decision rather than this project's.
