"use strict";

// "Send to the remainder", and the one way it could be worse than not existing.
//
// The feature: a campaign reached 900 of 1,000, and the owner wants the other
// 100 without re-mailing the 900. lib/growth-studio-dispatch.cjs named this as
// blocked on a per-recipient record; public.growth_campaign_sends is that
// record, and these assertions are about the route that uses it.
//
// The failure this file exists to prevent is specific and it is not a crash:
//
//   An unreadable send record produces zero accepted rows. Zero accepted rows
//   make every recipient look unreached. "Everybody is unreached" mails
//   everybody a second time -- under a button labelled "send only to the people
//   we missed".
//
// So the interesting assertions here are the refusals. A remainder send that
// cannot read the record must send NOTHING, and the test checks that no email
// left rather than only that the status code was 503: a handler that returned
// 503 after dispatching would satisfy the status assertion and be the bug.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

const SEND_PATH = `/api/growth/campaigns/${CAMPAIGN_ID}/send`;
const REMAINDER_PATH = `/api/growth/campaigns/${CAMPAIGN_ID}/remainder`;
const MESSAGE = { approved: true, subject: "Spring service check", body: "Your annual service is due." };

const ID = (n) => `4444444${n}-4444-4444-8444-44444444444${n}`;
const THREE = [
  { id: ID(1), name: "One", email: "one@example.com", status: "new", campaign_id: CAMPAIGN_ID },
  { id: ID(2), name: "Two", email: "two@example.com", status: "new", campaign_id: CAMPAIGN_ID },
  { id: ID(3), name: "Three", email: "three@example.com", status: "new", campaign_id: CAMPAIGN_ID }
];
const CONSENTS = THREE.map((row) => ({
  lead_id: row.id,
  channel: "email",
  consent_status: "granted",
  purpose: "marketing",
  withdrawn_at: null,
  expires_at: null
}));

function harness({
  leads = THREE,
  consents = CONSENTS,
  // The send record. `null` means the read fails -- which is the case this file
  // is mostly about -- and an array means it succeeded and returned those rows.
  sendRecord = [],
  ledgerRows = [{ entry_kind: "grant", amount_minor: 100000 }],
  ledgerStatus = 201
} = {}) {
  const calls = { sentTo: [], ledgerRows: [], events: [], sendRecordWrites: [] };

  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";

    if (target.startsWith("https://api.resend.com/suppressions")) {
      return new Response(JSON.stringify({ object: "list", data: [], has_more: false }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.startsWith("https://api.resend.com/emails")) {
      const payload = JSON.parse(options.body);
      const recipients = Array.isArray(payload) ? payload.flatMap((one) => one.to) : payload.to;
      calls.sentTo.push(...recipients);
      const body = Array.isArray(payload)
        ? { data: payload.map((_, index) => ({ id: `sent-${index}` })) }
        : { id: "sent" };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_campaign_sends")) {
      if (method === "POST") {
        calls.sendRecordWrites.push(JSON.parse(options.body));
        return new Response(null, { status: 201 });
      }
      // The read. A 500 is how "the record could not be read" is expressed,
      // and it is the only realistic way: PostgREST answers a failed read with
      // a status, not with a missing body.
      if (sendRecord === null) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(sendRecord), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/usage_credit_ledger") && method === "POST") {
      calls.ledgerRows.push(JSON.parse(options.body));
      return new Response(null, { status: ledgerStatus });
    }
    if (target.includes("/rest/v1/usage_credit_ledger")) {
      return new Response(JSON.stringify(ledgerRows), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_campaigns")) {
      return new Response(
        JSON.stringify([{ id: CAMPAIGN_ID, organization_id: ORGANIZATION_ID, name: "Spring", status: "draft", channel: "email" }]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (target.includes("/rest/v1/growth_leads")) {
      return new Response(JSON.stringify(leads), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_contact_consents")) {
      return new Response(JSON.stringify(consents), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_control_events")) {
      calls.events.push(JSON.parse(options.body));
      return new Response(JSON.stringify([{}]), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    layout: (data) => `<html><h1>${data.heading}</h1>${(data.sections || []).join("")}</html>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireWorkspaceAccess: () => (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    getReadiness: () => ({ services: { emailDelivery: "enabled" } }),
    getEnv: (name) =>
      ({
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "growth@sonara.test",
        NEXT_PUBLIC_SITE_URL: "https://app.sonara.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
      })[name]
  });

  return { app, calls, fetchImpl };
}

async function withFetch(fetchImpl, run) {
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

async function send(options = {}, body = MESSAGE) {
  const { app, calls, fetchImpl } = harness(options);
  const response = await withFetch(fetchImpl, () => request(app).post(SEND_PATH).send(body));
  return { response, calls };
}

async function readRemainder(options = {}, query = "") {
  const { app, calls, fetchImpl } = harness(options);
  const response = await withFetch(fetchImpl, () =>
    request(app).get(`${REMAINDER_PATH}${query}`).set("Accept", "application/json")
  );
  return { response, calls };
}

const accepted = (email) => ({ email, status: "accepted", provider_message_id: "x", created_at: "2026-09-16T00:00:00Z" });

describe("a remainder send refuses what it cannot know", () => {
  it("sends nothing when the send record cannot be read", async () => {
    const { response, calls } = await send({ sendRecord: null }, { ...MESSAGE, remainder_only: true });

    // These two come FIRST, and the order is deliberate rather than tidy.
    //
    // Asserted after the status code, they never fire: breaking the refusal
    // makes the status wrong too, so the failure an engineer reads is
    // "409 !== 503" -- true, and it says nothing about what went wrong. The
    // harm here is that three people were mailed a second time under a button
    // that promised not to, so that is the sentence the failure has to print.
    //
    // Verified by breaking it: with `remainderFrom` returning the whole list
    // on a failed read, this is the assertion that catches it, by name.
    assert.deepEqual(calls.sentTo, [], "a remainder send with an unreadable record mailed somebody");
    assert.deepEqual(calls.ledgerRows, [], "a remainder send with an unreadable record was charged");

    assert.equal(response.status, 503);
    assert.equal(response.body.code, "remainder_unknown");

    // And it says which read failed, rather than only that something did. An
    // owner who cannot tell an outage from an empty list cannot act on either.
    assert.match(String(response.body.remainderCode), /send_record_read_failed_500/);
    assert.match(String(response.body.reason), /would re-mail whoever was reached/i);
  });

  it("refuses rather than reporting everybody as unreached", async () => {
    // The same failed read, through the READ endpoint. This is the quieter half
    // of the same defect: no email is sent, but the owner is shown their entire
    // contact list under the heading "still to reach" and presses the button
    // themselves.
    const { response } = await readRemainder({ sendRecord: null });

    // Same ordering, same reason: the list is the harm, so it is asserted
    // before the status code.
    assert.equal(response.body.remainder, undefined, "a failed record read produced a list of people to mail");
    assert.equal(response.body.remainderCount, undefined);
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.code, "remainder_unknown");
  });

  it("sends only the people with no accepted row", async () => {
    const { response, calls } = await send(
      { sendRecord: [accepted("one@example.com"), accepted("TWO@Example.com")] },
      { ...MESSAGE, remainder_only: true }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls.sentTo, ["three@example.com"], "the remainder send did not reach exactly the unreached");
    assert.equal(response.body.remainder.known, true);
    assert.equal(response.body.remainder.alreadyReached, 2);
    assert.equal(response.body.remainder.sentTo, 1);

    // Case-folded, matching lower(email) in growth_campaign_sends_accepted_once.
    // `TWO@Example.com` above is the point: a record keyed one way and a
    // remainder computed the other way mails a real person twice.
    assert.ok(!calls.sentTo.includes("two@example.com"), "an accepted address in different case was treated as unreached");
  });

  it("charges the remainder send on its own key", async () => {
    const { response, calls } = await send(
      { sendRecord: [accepted("one@example.com"), accepted("two@example.com")] },
      { ...MESSAGE, remainder_only: true }
    );

    assert.equal(calls.ledgerRows.length, 1);
    const key = calls.ledgerRows[0].idempotency_key;

    // The failure this guards is a silent one. The first send's charge is keyed
    // `campaign:<id>`; if the remainder reused it, the ledger's unique index
    // declines the charge as a duplicate, the stragglers are still emailed, we
    // still pay Resend, and nobody is billed. The dispatcher's own header calls
    // that missing signal out -- this is the same hole pointing the other way.
    assert.notEqual(key, `campaign:${CAMPAIGN_ID}`, "the remainder send reused the first send's charge key");
    assert.match(key, new RegExp(`^campaign:${CAMPAIGN_ID}:remainder-[0-9a-f]{16}$`));
    assert.equal(response.body.chargeReference, key, "the response and the ledger disagree about which key was charged");
    assert.equal(calls.ledgerRows[0].metadata.send_attempt, key.split(":").pop());
  });

  it("keys a retry of the same remainder identically", async () => {
    // Stable, so a retry of THIS remainder is declined as the duplicate it is.
    // A timestamp or a random id here would make every retry a fresh charge,
    // which is the overcharge the idempotency key exists to prevent.
    const record = [accepted("one@example.com")];
    const first = await send({ sendRecord: record }, { ...MESSAGE, remainder_only: true });
    const second = await send({ sendRecord: record }, { ...MESSAGE, remainder_only: true });

    assert.equal(first.calls.ledgerRows[0].idempotency_key, second.calls.ledgerRows[0].idempotency_key);

    // And a DIFFERENT remainder takes a different key, or the second remainder
    // of a campaign would be declined as a duplicate of the first.
    const narrower = await send(
      { sendRecord: [accepted("one@example.com"), accepted("two@example.com")] },
      { ...MESSAGE, remainder_only: true }
    );
    assert.notEqual(
      narrower.calls.ledgerRows[0].idempotency_key,
      first.calls.ledgerRows[0].idempotency_key,
      "two different remainders of one campaign share a charge key, so the second is declined as a duplicate"
    );
  });

  it("sends nothing when everybody has already been reached", async () => {
    const { response, calls } = await send(
      { sendRecord: THREE.map((row) => accepted(row.email)) },
      { ...MESSAGE, remainder_only: true }
    );

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "all_reached");
    assert.equal(response.body.alreadyReached, 3);
    assert.deepEqual(calls.sentTo, [], "a campaign with nobody left to reach sent anyway");
    assert.deepEqual(calls.ledgerRows, [], "a campaign with nobody left to reach was charged anyway");
  });

  it("treats a failed row as somebody still to reach", async () => {
    // Only an accepted row means an email is in an inbox. A failed one was
    // attempted and refused, and that person is precisely who the remainder is
    // for -- so filtering on status is the whole correctness of this feature,
    // and a filter that matched any row would silently drop them.
    const { calls } = await send(
      {
        sendRecord: [
          accepted("one@example.com"),
          { email: "two@example.com", status: "failed", provider_message_id: null, created_at: "2026-09-16T00:00:00Z" },
          { email: "three@example.com", status: "not_attempted", provider_message_id: null, created_at: "2026-09-16T00:00:00Z" }
        ]
      },
      { ...MESSAGE, remainder_only: true }
    );

    assert.deepEqual(calls.sentTo.sort(), ["three@example.com", "two@example.com"]);
  });

  it("does not narrow a send that did not ask to be narrowed", async () => {
    // The default has to stay the default. A flag read as truthy when absent
    // would turn every ordinary send into a remainder send, and on a campaign
    // with a full record that is a send to nobody.
    const { response, calls } = await send({ sendRecord: THREE.map((row) => accepted(row.email)) }, MESSAGE);

    assert.equal(response.status, 200);
    assert.equal(calls.sentTo.length, 3, "an ordinary send was narrowed by a record it never asked about");
    assert.equal(response.body.remainder, undefined);
    assert.equal(calls.ledgerRows[0].idempotency_key, `campaign:${CAMPAIGN_ID}`, "an ordinary send's charge key changed shape");
    assert.equal(calls.ledgerRows[0].metadata.send_attempt, null);
  });

  it("reports what remains without sending anything", async () => {
    const { response, calls } = await readRemainder({ sendRecord: [accepted("one@example.com")] });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.alreadyReached, 1);
    assert.equal(response.body.remainderCount, 2);
    assert.deepEqual(response.body.remainder.map((row) => row.email).sort(), ["three@example.com", "two@example.com"]);

    // A read that can mail somebody is not a read.
    assert.deepEqual(calls.sentTo, []);
    assert.deepEqual(calls.ledgerRows, []);

    // The caveat is carried rather than left to be worked out: this is the
    // suppression-screened list and consent is applied when the send is
    // authorised, so the number actually mailed can be lower.
    assert.equal(response.body.consentAppliedAtSend, true);
  });

  it("scopes both the record read and the campaign read to the organization", async () => {
    // The service-role key bypasses RLS, so `organization_id=eq.` IS the tenant
    // boundary on these reads. A remainder computed without it would mix another
    // organization's accepted rows into this one's answer -- and the visible
    // symptom would be somebody's customer never being emailed, which nobody
    // reports as a bug.
    const seen = [];
    const { app, fetchImpl } = harness({ sendRecord: [] });
    const wrapped = async (url, options) => {
      seen.push(String(url));
      return fetchImpl(url, options);
    };
    await withFetch(wrapped, () => request(app).get(REMAINDER_PATH).set("Accept", "application/json"));

    const recordRead = seen.find((url) => url.includes("/rest/v1/growth_campaign_sends?"));
    assert.ok(recordRead, "the remainder endpoint never read the send record");
    assert.match(recordRead, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`));
    assert.match(recordRead, new RegExp(`campaign_id=eq\\.${CAMPAIGN_ID}`));

    const campaignRead = seen.find((url) => url.includes("/rest/v1/growth_campaigns?"));
    assert.ok(campaignRead, "the remainder endpoint never loaded the campaign");
    assert.match(campaignRead, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`));
  });

  it("offers the owner the tickbox, in their words", async () => {
    // The API without the control is a feature nobody can reach. And the copy
    // is asserted rather than the input alone, because the promise on the page
    // is the whole reason an owner would tick it: if we cannot confirm who was
    // reached, nothing is sent.
    const { app, fetchImpl } = harness();
    const page = await withFetch(fetchImpl, () =>
      request(app).get("/growth-studio/your-campaigns").set("Accept", "text/html")
    );

    assert.equal(page.status, 200);
    assert.match(page.text, /name="remainder_only"/, "the send form has no way to skip people already reached");
    assert.match(page.text, /Skip anyone this campaign already reached/);
    assert.match(page.text, /nothing is sent -- rather than sending to everyone again/);
  });

  it("records on the audit event that the send was a remainder", async () => {
    const { calls } = await send({ sendRecord: [accepted("one@example.com")] }, { ...MESSAGE, remainder_only: true });

    const event = calls.events.map((rows) => (Array.isArray(rows) ? rows[0] : rows)).find((row) => row?.event_type === "campaign.sent");
    assert.ok(event, "no campaign.sent event was written");
    // `details` is the column controlEvent writes the payload into, via
    // sanitizeProviderPayload. Named explicitly rather than probed across
    // three possible field names: a test that accepts whichever shape it finds
    // would keep passing if the payload moved somewhere nobody reads.
    const details = event.details;
    assert.ok(details, "the campaign.sent event carries no details");
    assert.equal(details.remainder_only, true, "the audit trail cannot tell a remainder send from a second full send");
    assert.equal(details.already_reached, 1);
    assert.match(String(details.charge_reference), /remainder-/);
  });
});
