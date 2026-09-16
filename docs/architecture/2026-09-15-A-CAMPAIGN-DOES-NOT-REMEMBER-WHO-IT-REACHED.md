# A campaign does not remember who it reached

Review by: 2026-12-15

Nothing in this product records which recipients a campaign was sent to. After a
send, the database holds a `growth_control_events` row saying `sent: 201,
failed: 0, skipped: 3` and cannot say to whom.

Read on 15 September 2026 from `lib/growth-studio-dispatch.cjs`,
`routes/growth-studio-control-routes.cjs` and the migrations. Three consequences
follow, and they are ordered by how much harm each does.

---

## 1. The product told the owner to do the one irreversible thing

`dispatchCampaign` bounds its per-recipient fallback at two batches, because
1,000 individual sends would exceed the function's 300-second lifetime. Past
that bound the remaining recipients are reported as **not attempted**, and the
summary an owner read ended:

> `201 sent, 100 not attempted -- send again to reach them.`

**Following that instruction mails the 201 a second time.** There is no
send-to-the-remainder path, and no record of who the 201 were.

Worse, the owner would not find out. The usage-ledger charge is keyed on the
campaign id, so the second send's charge is refused as a duplicate and the
balance does not move — removing the one signal that would have shown a
duplicate send. And a repeat send is not otherwise blocked: the only status guard
on the endpoint refuses `completed` and `archived` campaigns, and a successful
send does not set either.

This was in the file that refuses to send a campaign at all without a working
unsubscribe link, on the stated grounds that *"the mail is in somebody's inbox,
they have no way to stop the next one"*. The same irreversibility, in the
summary line.

**Fixed.** The summary now says what is true — the addresses are listed, and
sending again would re-send to everyone already reached —
and `tests/an-owner-told-a-hundred-were-missed-can-find-out-which.test.js`
asserts it does not say "send again".

## 2. The addresses were computed, returned, and dropped

`dispatchCampaign` returns `notAttempted` as `[{ email, reason }]`. The send
route forwarded `sent`, `failed`, `skipped` and `charge`, and **not that**. So an
owner was told "100 not attempted" with no way to learn which hundred.

This is the third defect shape in `.claude/skills/checks-that-cannot-lie` — a
value produced for a decision and never used — at a route boundary rather than
inside a query. And the existing test asserting those recipients *"must be
reported, not silently dropped"* was asserting it against the dispatcher's
return value, one layer below the layer that dropped them: the sixth shape, a
check too weak to catch the thing it was written for.

**Fixed.** The route forwards them, and the new test asserts it at the HTTP
boundary with the batch path genuinely exercised. No route-level test had
exercised the batch endpoint at all before — every send test used few enough
recipients to stay on the single-send path, which is not the path a real campaign
takes.

## 3. Two features cannot be built until a campaign remembers

Both of these are named as open elsewhere, and this is the reason they are.

**Sending to the remainder.** "Reach the hundred nobody tried" needs to know
which hundred are already reached. The addresses now come back in the response,
so an owner can see them, but the product cannot act on them.

**Sending to more than 1,000 recipients.**
`MAX_RECIPIENTS_PER_SEND = 1000` is derived from the 300-second function
lifetime, and the comment on it is right that reaching further "needs sending
across more than one invocation, which is a queue and is not built". A queue is
the smaller half of that problem. **The larger half is that a second invocation
has no way to know where the first one stopped**, and resuming without that
knowledge re-mails people — the same harm as item 1, arriving automatically
rather than on a button.

There is a drainer available: `.github/workflows/agent-schedule-tick.yml` drives
an authenticated endpoint hourly, because Vercel's Hobby tier permits only daily
cron. So the scheduling half is a solved pattern here. The state half is not.

---

## What a fix has to get right

Recorded now because the reasoning is the hard part and it is fresh, not because
the table is being written today.

1. **One row per recipient per campaign send**, carrying the address, the
   outcome (`accepted`, `failed`, `not_attempted`), and the reason. Keyed so a
   repeat write for the same campaign and address cannot duplicate.
2. **Written before the send is attempted, not after.** The two orders fail
   differently and only one fails safely: record-then-send can lose a recipient
   (recorded, never mailed) and send-then-record can mail twice (mailed, never
   recorded). A person who never receives an email is recoverable; a person who
   receives it twice is not.
3. **Reading the existing rows must fail closed.** If the "who has already been
   reached" query fails, the send is refused. Sending on a failed read is
   precisely the double-send, and it would arrive under a green result.
4. **Three outcomes, not two.** `not_attempted` is not `failed` — the route and
   the dispatcher already keep them apart, and a table that collapsed them would
   lose the distinction the owner acts on.
5. **It does not change who may send.** `AGENTS.md` requires owner approval for
   customer campaigns, `authoriseCampaign` takes the approver from the
   authenticated caller and never from the body, and a continuation is the
   completion of an approved send rather than a new one. A resumption path must
   carry the original approval rather than re-deriving one.

## What is deliberately not claimed here

That any of this is urgent for a customer today. Email delivery is off unless
`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set and readiness reports
`emailDelivery: "enabled"`, and the 1,000 cap refuses rather than truncating. The
harm in item 1 needed a campaign large enough to exhaust the fallback budget —
201 recipients with a misbehaving provider — which is reachable and was not
guarded.
