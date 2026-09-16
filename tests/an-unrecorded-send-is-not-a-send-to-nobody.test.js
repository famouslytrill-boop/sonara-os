"use strict";

// The record of who a campaign reached, and the one way it could lie.
//
// `lib/growth-studio-dispatch.cjs` reached 900 of 1,000 and told the owner which
// 100 were not attempted. The only way to reach those 100 was to send the
// campaign again, which mails the first 900 a second time — and the charge is
// keyed on `campaign:<id>`, so the duplicate send is refused as a duplicate
// charge and the owner is never billed, removing the one signal that would have
// told them it happened. The dispatcher's header has named that gap since 15
// September 2026 and said the fix needs a per-recipient record.
//
// `public.growth_campaign_sends` and `lib/growth-studio-send-records.cjs` are
// that record. This test is about the failure mode it introduces rather than the
// one it fixes:
//
//   **Zero accepted rows has two opposite causes** — nothing was sent, or the
//   record was not written — and they are the same value. Read one as the other
//   and the product tells an owner it is safe to re-mail everybody, which is
//   worse than the gap it replaced, because now there is a record to point at.
//
// So every assertion below is about absence: a failed read, a missing writer, a
// partial write, a bare array where an outcome was required.

const assert = require("node:assert/strict");

const {
  sendRowsFor,
  remainderFrom,
  normaliseEmail,
  createSendRecorder,
  createSendRecordReader,
  MAX_INDIVIDUAL_RETRIES
} = require("../lib/growth-studio-send-records.cjs");
const { dispatchCampaign } = require("../lib/growth-studio-dispatch.cjs");
const { authoriseCampaign } = require("../lib/growth-studio-sender.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const CONFIG = { ok: true, url: "https://project.supabase.co", serviceRoleKey: "service-role-stub" };

function ok(body = null, status = 200) {
  return { ok: true, status, json: async () => body };
}
function notOk(status) {
  return { ok: false, status, json: async () => null };
}

describe("an unrecorded send is not a send to nobody", () => {
  describe("what gets written", () => {
    it("builds one row per address, across all three outcomes", () => {
      const built = sendRowsFor({
        organizationId: ORG,
        campaignId: CAMPAIGN,
        accepted: [{ email: "a@example.com", providerMessageId: "msg-1" }, "b@example.com"],
        failed: [{ email: "c@example.com", status: 422 }],
        notAttempted: [{ email: "d@example.com", reason: "fallback_budget_spent" }]
      });

      assert.equal(built.ok, true);
      assert.equal(built.rows.length, 4);
      assert.equal(built.acceptedCount, 2);
      assert.deepEqual(built.rows.map((row) => row.status), ["accepted", "accepted", "failed", "not_attempted"]);
      // The id from the batch path is kept; the individual path has none and
      // says so rather than inventing one.
      assert.equal(built.rows[0].provider_message_id, "msg-1");
      assert.equal(built.rows[1].provider_message_id, null);
      // A 422 is a bad address and a 429 is a rate limit. An owner does
      // something different about each, so the status is stored.
      assert.equal(built.rows[2].provider_status, 422);
      assert.equal(built.rows[3].reason, "fallback_budget_spent");
    });

    it("refuses to build a record that does not name its organization", () => {
      // The service-role key bypasses RLS, so organization_id is the tenant
      // boundary. A row without one is a row in no tenant.
      const built = sendRowsFor({ campaignId: CAMPAIGN, accepted: ["a@example.com"] });
      assert.equal(built.ok, false);
      assert.equal(built.code, "no_organization");
      assert.deepEqual(built.rows, []);
    });

    it("counts an acceptance with no address instead of dropping it silently", () => {
      // An acceptance with no address claims somebody was reached without
      // saying who. The count is what tells a reader the record is incomplete.
      const built = sendRowsFor({
        organizationId: ORG,
        campaignId: CAMPAIGN,
        accepted: [{ email: "  ", providerMessageId: "msg-9" }, "real@example.com"]
      });
      assert.equal(built.rows.length, 1);
      assert.equal(built.dropped.length, 1);
      assert.equal(built.dropped[0].reason, "no_email");
    });

    it("collapses one send's duplicate acceptance the way the index would", () => {
      // growth_campaign_sends_accepted_once is on lower(email), so these are
      // one person. Collapsing here means one bad batch does not fail the whole
      // insert and lose the rest of the record.
      const built = sendRowsFor({
        organizationId: ORG,
        campaignId: CAMPAIGN,
        accepted: ["Ann@Example.com", "ann@example.com"]
      });
      assert.equal(built.acceptedCount, 1);
      assert.equal(built.rows.length, 1);
      assert.equal(built.dropped[0].reason, "duplicate_in_one_send");
      // And the stored address is what the owner has on file, not the folded one.
      assert.equal(built.rows[0].email, "Ann@Example.com");
      assert.equal(normaliseEmail(built.rows[0].email), "ann@example.com");
    });
  });

  describe("what may be concluded from it", () => {
    const recipients = ["a@example.com", "b@example.com", "c@example.com"];

    it("returns the remainder when the record was read", () => {
      const remainder = remainderFrom(recipients, {
        ok: true,
        rows: [{ email: "A@example.com", status: "accepted" }, { email: "b@example.com", status: "failed" }]
      });
      assert.equal(remainder.known, true);
      assert.equal(remainder.alreadyReached, 1);
      // b failed, so b still needs reaching. Only an accepted row means an
      // email is in somebody's inbox — that filter is the whole correctness.
      assert.deepEqual(remainder.remainder, ["b@example.com", "c@example.com"]);
    });

    it("refuses to answer when the read failed, rather than answering everybody", () => {
      // THE assertion this file exists for. An empty rows array from a failed
      // read must not become "nobody was reached, so send to all three".
      const remainder = remainderFrom(recipients, { ok: false, code: "send_record_read_failed_500", rows: [] });
      assert.equal(remainder.known, false);
      assert.deepEqual(remainder.remainder, []);
      assert.equal(remainder.alreadyReached, 0);
      assert.match(remainder.detail, /would re-mail whoever was reached/);
    });

    it("refuses a bare array, because a bare array cannot carry a failure", () => {
      // Passing `outcome.rows` instead of `outcome` is the mistake that would
      // reintroduce the bug, and it is silent: both are arrays.
      const remainder = remainderFrom(recipients, []);
      assert.equal(remainder.known, false);
      assert.equal(remainder.code, "outcome_not_carried");
      assert.deepEqual(remainder.remainder, []);
    });

    it("distinguishes a real empty record from an unreadable one", () => {
      // A campaign that genuinely reached nobody IS knowable, and its remainder
      // is everybody. That has to still work, or the guard above has just
      // broken the feature instead of protecting it.
      const remainder = remainderFrom(recipients, { ok: true, rows: [] });
      assert.equal(remainder.known, true);
      assert.deepEqual(remainder.remainder, recipients);
    });

    it("says all reached when everybody has an accepted row", () => {
      const remainder = remainderFrom(recipients, {
        ok: true,
        rows: recipients.map((email) => ({ email, status: "accepted" }))
      });
      assert.equal(remainder.known, true);
      assert.equal(remainder.code, "all_reached");
      assert.deepEqual(remainder.remainder, []);
    });
  });

  describe("the writer", () => {
    it("records the batch when the insert lands", async () => {
      const calls = [];
      const record = createSendRecorder({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return ok(null, 201); }
      });
      const result = await record([{ email: "a@example.com", status: "accepted" }]);
      assert.equal(result.ok, true);
      assert.equal(result.written, 1);
      assert.equal(calls.length, 1, "one batch insert, not one call per row");
      assert.match(calls[0].url, /growth_campaign_sends/);
    });

    it("re-inserts individually on a conflict, because a batch 409 names no row", async () => {
      // PostgREST fails the whole statement on a unique violation without
      // saying which row conflicted. This repository's rule about the
      // undocumented batch-email response applies: retry in a form that cannot
      // be ambiguous rather than guess.
      let call = 0;
      const record = createSendRecorder({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async () => {
          call += 1;
          if (call === 1) return notOk(409);       // the batch
          if (call === 2) return notOk(409);       // already recorded
          return ok(null, 201);                    // newly recorded
        }
      });
      const result = await record([
        { email: "already@example.com", status: "accepted" },
        { email: "new@example.com", status: "accepted" }
      ]);
      assert.equal(result.ok, true, "an already-recorded acceptance is a true fact already stored");
      assert.equal(result.written, 1);
      assert.equal(result.duplicate, 1);
      assert.equal(call, 3);
    });

    it("reports a partial write rather than claiming the record is complete", async () => {
      let call = 0;
      const record = createSendRecorder({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async () => { call += 1; return call === 1 ? notOk(409) : call === 2 ? ok(null, 201) : notOk(500); }
      });
      const result = await record([
        { email: "landed@example.com", status: "accepted" },
        { email: "lost@example.com", status: "accepted" }
      ]);
      assert.equal(result.ok, false, "one unrecorded acceptance means the remainder is not computable");
      assert.equal(result.code, "send_record_partially_written");
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0].email, "lost@example.com");
    });

    it("refuses to attribute a conflict too large to re-insert in one invocation", async () => {
      const record = createSendRecorder({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async () => notOk(409)
      });
      const rows = Array.from({ length: MAX_INDIVIDUAL_RETRIES + 1 }, (_, index) => ({
        email: `person-${index}@example.com`,
        status: "accepted"
      }));
      const result = await record(rows);
      assert.equal(result.ok, false);
      assert.equal(result.code, "send_record_conflict_too_large_to_attribute");
      assert.match(result.detail, /which of them landed is unknown/);
    });

    it("does not claim success when Supabase is unconfigured", async () => {
      const record = createSendRecorder({ getSupabaseServerConfig: () => ({ ok: false }) });
      const result = await record([{ email: "a@example.com", status: "accepted" }]);
      assert.equal(result.ok, false);
      assert.equal(result.code, "supabase_unconfigured");
      assert.equal(result.written, 0);
    });
  });

  describe("the reader", () => {
    it("filters on the organization, which is the whole tenant boundary here", async () => {
      let requested = "";
      const read = createSendRecordReader({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async (url) => { requested = String(url); return ok([]); }
      });
      const result = await read({ organizationId: ORG, campaignId: CAMPAIGN });
      assert.equal(result.ok, true);
      // The service-role key bypasses RLS. Without this filter the read would
      // return every organization's send record.
      assert.ok(requested.includes(`organization_id=eq.${ORG}`), `organization filter missing from ${requested}`);
      assert.ok(requested.includes(`campaign_id=eq.${CAMPAIGN}`));
    });

    it("refuses a read with no organization", async () => {
      const read = createSendRecordReader({ getSupabaseServerConfig: () => CONFIG, fetchImpl: async () => ok([]) });
      assert.equal((await read({ campaignId: CAMPAIGN })).ok, false);
    });

    it("refuses a truncated record rather than returning it short", async () => {
      // A short record understates who was reached, and understating it is
      // exactly what re-mails somebody.
      const read = createSendRecordReader({
        getSupabaseServerConfig: () => CONFIG,
        fetchImpl: async () => ok(Array.from({ length: 12 }, (_, i) => ({ email: `p${i}@example.com`, status: "accepted" }))),
        rowLimit: 10
      });
      const result = await read({ organizationId: ORG, campaignId: CAMPAIGN });
      assert.equal(result.ok, false);
      assert.equal(result.code, "send_record_too_large_to_read");
      assert.deepEqual(result.rows, []);
      // And it composes: an unreadable record must not become a remainder.
      assert.equal(remainderFrom(["a@example.com"], result).known, false);
    });
  });

  describe("the dispatcher's own report", () => {
    // Driven through authoriseCampaign and getEnv/getReadiness rather than a
    // hand-built decision object. The first version of this block invented the
    // parameter shape -- `authorised: true`, a direct `apiKey` -- and every
    // assertion in it read `undefined.ok`, because the dispatcher refused at
    // `decision.allowed !== true` and returned before reaching any of this.
    // A fixture that does not match the product tests nothing.
    const ENV = {
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "hello@example.com",
      // The unsubscribe signing key is derived from this when
      // SONARA_UNSUBSCRIBE_SECRET is unset, and the dispatcher refuses to send
      // a campaign it cannot supply a way out of.
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
    };

    const SEND = {
      subject: "A subject",
      body: "A body long enough to be real.",
      organizationId: ORG,
      campaignId: CAMPAIGN,
      origin: "https://app.example.com",
      getEnv: (name) => ENV[name],
      getReadiness: () => ({ services: { emailDelivery: "enabled" } })
    };

    let nextLead = 1;
    function authorised(count) {
      return authoriseCampaign({
        approval: { status: "approved", approved_by: "owner-1" },
        // The balance reader. Without it authoriseCampaign refuses with
        // `balance_unreadable` and the dispatcher never reaches the send path --
        // which is how the first version of this block came to assert against
        // `undefined`: the fixture was refused, not the product.
        history: { ok: true, rows: [{ entry_kind: "grant", amount_minor: 100000000 }] },
        recipients: Array.from({ length: count }, (_, index) => ({
          // Distinct ids: the unsubscribe token is derived from the lead id, so
          // repeated ids would share tokens.
          id: `44444444-4444-4444-8444-${String(nextLead++).padStart(12, "0")}`,
          email: `p${index}@example.com`,
          consent: { channel: "email", consent_status: "granted" }
        }))
      });
    }

    it("tells the owner the remainder is known when the record was written", async () => {
      const decision = authorised(2);
      assert.equal(decision.allowed, true, "fixture does not authorise; nothing below would run");

      const rows = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => ok({ data: [{ id: "msg-a" }, { id: "msg-b" }] }, 200),
        recordSends: async (written) => { rows.push(...written); return { ok: true, code: "recorded", written: written.length }; }
      });

      assert.equal(result.sent, 2);
      assert.equal(result.recorded.ok, true);
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.organization_id === ORG && row.campaign_id === CAMPAIGN));
      assert.ok(rows.every((row) => row.status === "accepted"));
      // The batch response is index-aligned by the documented contract, so each
      // id names the message at the same position. Kept rather than discarded.
      assert.deepEqual(rows.map((row) => row.provider_message_id).sort(), ["msg-a", "msg-b"]);
      // And the lead id is carried, matched on the folded address.
      assert.ok(rows.every((row) => typeof row.lead_id === "string" && row.lead_id.length > 0));
    });

    it("warns about a double send when the record was NOT written", async () => {
      // The dispatcher's owner-facing sentence has to change with this, or the
      // record's absence reads exactly like its presence.
      const decision = authorised(2);
      const reported = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => ok({ data: [{ id: "msg-a" }, { id: "msg-b" }] }, 200),
        recordSends: async () => ({ ok: false, code: "send_record_write_failed" }),
        report: (entry) => reported.push(entry)
      });

      assert.equal(result.sent, 2);
      assert.equal(result.recorded.ok, false);
      assert.equal(result.recorded.code, "send_record_write_failed");
      assert.ok(
        reported.some((entry) => /per-recipient record was NOT written/.test(entry.detail || "")),
        `the failed record write was not reported: ${JSON.stringify(reported)}`
      );
    });

    it("changes the not-attempted sentence with whether the record survived", async () => {
      // The sentence an owner reads is the product here. With a record, the
      // remainder is workable; without one, sending again re-mails everybody.
      const many = () => authorised(301);
      const fetchImpl = async (url, options) => {
        const payload = JSON.parse(options.body);
        // Batches never return one id per email, so every batch falls back; the
        // fallback budget then runs out and the rest are not attempted.
        // A batch whose `data` is short cannot be reconciled, so every batch
        // falls back to individual sends -- which is how the fallback budget
        // runs out and the remainder becomes not-attempted.
        return Array.isArray(payload) ? ok({ data: [] }, 200) : ok({ id: "msg" }, 200);
      };

      const withRecord = await dispatchCampaign({
        ...SEND, decision: many(), appendLedger: async () => ({ ok: true }), fetchImpl,
        recordSends: async (rows) => ({ ok: true, code: "recorded", written: rows.length })
      });
      assert.ok(withRecord.notAttempted.length > 0, "fixture produced no not-attempted recipients");
      assert.match(withRecord.detail, /who was already reached is on record/);
      assert.doesNotMatch(withRecord.detail, /would re-mail everyone above/);

      const withoutRecord = await dispatchCampaign({
        ...SEND, decision: many(), appendLedger: async () => ({ ok: true }), fetchImpl,
        recordSends: async () => ({ ok: false, code: "send_record_write_failed" }),
        report: () => {}
      });
      assert.ok(withoutRecord.notAttempted.length > 0);
      assert.match(withoutRecord.detail, /NOT recorded, so sending this campaign again would re-mail everyone above/);
    });

    it("says so when no record writer was supplied at all", async () => {
      // Absent and failed are different faults -- a caller that forgot to wire
      // this has a bug, a database that rejected the rows has an outage -- and
      // reporting them identically hides one of them.
      const reported = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision: authorised(1),
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => ok({ id: "msg" }, 200),
        report: (entry) => reported.push(entry)
      });
      assert.equal(result.sent, 1);
      assert.equal(result.recorded.ok, false);
      assert.equal(result.recorded.code, "send_record_not_wired");
      assert.ok(reported.some((entry) => entry.code === "send_record_not_wired"));
    });
  });
});
