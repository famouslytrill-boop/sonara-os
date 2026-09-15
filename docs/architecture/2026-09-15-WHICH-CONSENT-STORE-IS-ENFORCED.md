# Which consent store is the consent store

Review by: 2026-12-15

Six places in this schema record whether somebody agreed to be contacted. **Two
are enforced. Two are formally retired. Two are neither** — live columns on live
tables that nothing reads and nothing writes.

This was found by narrowing a `select=*`. The contact-card export read the whole
`customers` row, which includes `communication_preference` — the column whose
entire purpose is recording how a customer agreed to be contacted — and compared
it to nothing. That is the exact shape of the bug
`scripts/report-unused-selected-columns.mjs` was written for, so the first
question was whether an export was ignoring a customer's stated preference.

**It was not, and the reason is the finding.** Nothing anywhere fills that
column, so there is no preference on it to ignore.

Every figure below was measured on 15 September 2026 by grepping `lib/`,
`routes/`, `server.js` and `api/`, and by reading the `create table` statements
in `supabase/migrations/`.

---

## The six

| Store | Shape | Runtime references | Status |
|---|---|---|---|
| `growth_contact_consents` | `channel`, `consent_status`, `withdrawn_at`, `expires_at` | read by `lib/growth-studio-sender.cjs`, `lib/growth-studio-unsubscribe.cjs`, `lib/sonara-record-checks.cjs`; written by `/api/growth/consents` | **enforced** |
| `creator_voice_consents` | `consent_scope`, `consent_attested`, `evidence_type`, `revoked_at` | `CONSENT_TABLE` in `routes/creator-generation-routes.cjs` | **enforced** |
| `consent_records` | `channel`, `purpose`, `consent_status` | 2, both in contract lists | retired |
| `communication_preferences` | `channel`, `consent_status` | 2, both in contract lists | retired |
| `customers.communication_preference` | one `text` column, default `'unknown'` | **0** | live, unused |
| `phone_number_records.consent_status` | one `text` column, default `'unknown'` | **0** on the column | live, unused |

"Runtime references" counts every occurrence of the name, not just reads. Two of
the six have none at all.

### The two that are enforced

`lib/growth-studio-sender.cjs` is the one to read, because it gets the hard part
right. It reads `channel` as well as `consent_status`, on the stated grounds
that *"a permission to email somebody is not a permission to text them, and a
sender that ignores the channel column would treat the two as one."* It treats
`unknown` as not-consent, a withdrawal timestamp as outranking a status that
still says granted, and an unparseable expiry as lapsed rather than absent.

`routes/creator-generation-routes.cjs` is enforced now and is the reason this
repository has the check that found today's defect: `evaluatePolicy` selected
`consent_scope` on every voice job and compared it to nothing, so a permission
granted for text-to-speech authorised a voice clone.

### The two that are retired

`consent_records` and `communication_preferences` are both on
`lib/sonara-database-retirement-contract.cjs`, which means production is not
required to have them and `scripts/verify-production-supabase.mjs` warns that
they should be reviewed for archival. That is a decision somebody made, recorded
where the gate reads it. They are listed here so nobody meets the table name and
assumes it is the live store.

### The two that are neither

`customers.communication_preference` and `phone_number_records.consent_status`
are columns on tables the product uses every day. Both default to `'unknown'`.
Nothing writes either, so every row carries the default, and nothing reads
either, so nothing depends on that.

---

## The rule this produces

**A gate on a column nothing writes refuses everything, and looks like
enforcement while doing it.**

If the contact export had been changed to honour
`customers.communication_preference`, it would have refused every export for
every business — because the column is `'unknown'` on every row — and the refusal
message would have said the customer had not agreed to be contacted. A business
would have read that as a fact about their own customer. Adding the gate would
have been worse than the ignored column, and it would have looked like the
careful thing to do.

So the column is no longer fetched, and nothing was gated. The narrowed select is
in `routes/sonara-last9-routes.cjs` and
`tests/a-calendar-file-cannot-read-a-column-that-does-not-exist.test.js` asserts
both halves: that the export does not ask for the column, and that the column is
still in the schema — because if it is ever dropped, that assertion stops meaning
anything and should fail rather than pass silently.

## What an owner downloading an address book is

Not a campaign. `AGENTS.md` forbids automating *customer campaigns* without
owner approval and requires consent enforcement on outbound messaging. A business
owner exporting their own customer list as a `.vcf` to the phone they will ring
people from is neither: no message is sent, no third party receives anything, and
the owner already sees every one of those records on
`/business-builder/owner/customers`.

The consent question arrives when SONARA sends something. That path is
`growth_contact_consents` and it is gated.

## What is still open

1. **Whether the two live-but-unused columns should be written or dropped.** A
   per-customer channel preference is a real product idea — it is what stops a
   business texting somebody who asked to be emailed — and it would need a form
   field, a writer, and the sender reading it alongside
   `growth_contact_consents`. Until then the honest state is an empty column, not
   a gate.
2. **Whether `phone_number_records` has a purpose at all.** Its only runtime
   mentions are two registry lists. Either a telephony surface fills it, or it
   belongs on the retirement contract beside the other two.
3. **The inbound SMS webhook still has nowhere to write an opt-out.**
   `lib/sonara-sms-keywords.cjs` decides correctly what an inbound STOP means;
   `growth_contact_consents` is where the answer belongs, and the write is part
   of the carrier adapter that is waiting on the vendor decision in
   `docs/architecture/2026-09-10-CARRIER-VENDOR-COMPARISON.md`.
