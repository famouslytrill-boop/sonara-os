"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const {
  UNSUBSCRIBE_PATH,
  TOKEN_VERSION,
  CHANNEL,
  deriveSigningKey,
  signToken,
  verifyToken,
  unsubscribeUrl,
  unsubscribeHeaders,
  withUnsubscribeLine
} = require("../lib/growth-studio-unsubscribe.cjs");

// `growth_contact_consents` could record a permission and honour a withdrawal,
// and **nothing could set the withdrawal.** An owner could, from a form; the
// person who received the email could not, and they are the only one whose
// decision it is. So the consent system was elaborate and one-way.
//
// This endpoint is also the only unauthenticated write in Growth Studio, which
// makes it the one place where the token doing the authorising has to be right.
// RFC 8058 requires it: "The POST request MUST NOT include cookies, HTTP
// authorization, or any other context information."
//
// Three things these assertions are about:
//
//   * **A stranger holding a link cannot use it against anybody else.** The
//     token names one contact in one organization and is signed.
//   * **A GET does not unsubscribe anybody.** Mail scanners and inbox proxies
//     prefetch links, and a GET that withdrew consent on load would remove
//     people who never clicked.
//   * **A failed write is never reported as done.** Somebody told their
//     unsubscribe worked, when it did not, receives the next campaign -- and
//     that is the one place in this product where the complaint goes to a
//     regulator rather than to support.

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANIZATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SECRET = "a-signing-secret";
const KEY = deriveSigningKey(() => SECRET);
const TOKEN = signToken({ organizationId: ORGANIZATION_ID, leadId: LEAD_ID, key: KEY });

function harness({ patchRows = [{ id: "consent-1" }], patchOk = true, insertOk = true, configured = true } = {}) {
  const calls = { patches: [], inserts: [] };

  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";

    if (target.includes("/rest/v1/growth_contact_consents") && method === "PATCH") {
      calls.patches.push({ url: target, body: JSON.parse(options.body) });
      if (!patchOk) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(patchRows), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.includes("/rest/v1/growth_contact_consents") && method === "POST") {
      calls.inserts.push({ url: target, body: JSON.parse(options.body) });
      if (!insertOk) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify([{ id: "consent-new" }]), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    layout: (data) => `<html><h1>${data.heading}</h1><p>${data.body}</p>${(data.sections || []).join("")}</html>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireWorkspaceAccess: () => (req, res, next) => next(),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () =>
      configured ? { ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" } : { ok: false },
    getEnv: (name) => ({ SONARA_UNSUBSCRIBE_SECRET: SECRET }[name])
  });

  return { app, calls, fetchImpl };
}

async function call(method, query, options = {}, body = {}) {
  const { app, calls, fetchImpl } = harness(options);
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    const path = `${UNSUBSCRIBE_PATH}${query}`;
    const response = method === "get"
      ? await request(app).get(path).set("Accept", "text/html")
      : await request(app).post(path).type("form").send(body);
    return { response, calls };
  } finally {
    global.fetch = original;
  }
}

describe("a recipient can stop the emails", () => {
  describe("the token", () => {
    it("verifies the one it signed", () => {
      const verified = verifyToken(TOKEN, KEY);
      assert.equal(verified.ok, true);
      assert.equal(verified.organizationId, ORGANIZATION_ID);
      assert.equal(verified.leadId, LEAD_ID);
      assert.equal(verified.channel, CHANNEL);
    });

    it("names the email channel and never lets the token choose one", () => {
      // A token that could name its own channel would let a link from an email
      // withdraw somebody's SMS permission.
      assert.equal(CHANNEL, "email");
      assert.equal(verifyToken(TOKEN, KEY).channel, "email");
      const forged = `${TOKEN_VERSION}.${ORGANIZATION_ID}.${LEAD_ID}.sms.${TOKEN.split(".")[3]}`;
      assert.equal(verifyToken(forged, KEY).ok, false, "an extra field must not be read as a channel");
    });

    it("refuses a token signed with a different key", () => {
      const otherKey = deriveSigningKey(() => "a-different-secret");
      const verified = verifyToken(TOKEN, otherKey);
      assert.equal(verified.ok, false);
      assert.equal(verified.code, "bad_signature");
    });

    it("refuses a token whose contact was swapped after signing", () => {
      // The attack this exists to stop: hold your own valid link, change the
      // lead id, unsubscribe somebody else.
      const [version, organization, , provided] = TOKEN.split(".");
      const swapped = `${version}.${organization}.${OTHER_LEAD_ID}.${provided}`;
      assert.equal(verifyToken(swapped, KEY).ok, false, "a link must not work against another contact");
    });

    it("refuses a token whose organization was swapped after signing", () => {
      const [version, , lead, provided] = TOKEN.split(".");
      const swapped = `${version}.${OTHER_ORGANIZATION_ID}.${lead}.${provided}`;
      assert.equal(verifyToken(swapped, KEY).ok, false, "a link must not reach across into another business's records");
    });

    it("refuses malformed and empty tokens without throwing", () => {
      for (const token of ["", null, undefined, "x", "a.b.c", "a.b.c.d.e", TOKEN.slice(0, -1), `${TOKEN}x`]) {
        const verified = verifyToken(token, KEY);
        assert.equal(verified.ok, false, `${JSON.stringify(token)} must not verify`);
      }
    });

    it("refuses an old token version rather than reading it under new rules", () => {
      const [, organization, lead, provided] = TOKEN.split(".");
      assert.equal(verifyToken(`u0.${organization}.${lead}.${provided}`, KEY).code, "unknown_token_version");
    });

    it("refuses everything when no key is available, rather than accepting anything", () => {
      const verified = verifyToken(TOKEN, null);
      assert.equal(verified.ok, false);
      assert.equal(verified.code, "unsubscribe_not_configured");
    });

    it("derives a key from the service role key when no dedicated secret is set", () => {
      // This is why an unsubscribe link works on deploy with no owner step,
      // which it has to, because a campaign is not sent without one.
      const derived = deriveSigningKey((name) => ({ SUPABASE_SERVICE_ROLE_KEY: "sk" }[name]));
      assert.ok(derived, "no key would mean no campaign could be sent at all");
      // Same string in either variable must not produce the same key: the two
      // inputs need separating from each other, not only from other schemes.
      assert.notDeepEqual(derived, deriveSigningKey(() => "sk"), "the two sources must not derive the same key");
    });

    it("has no key at all when neither secret is set", () => {
      assert.equal(deriveSigningKey(() => undefined), null);
    });
  });

  describe("the link", () => {
    it("is https, or is not built", () => {
      assert.ok(unsubscribeUrl({ origin: "https://app.example.com", token: TOKEN }).startsWith("https://"));
      for (const origin of ["", null, undefined, "http://app.example.com", "app.example.com"]) {
        assert.equal(unsubscribeUrl({ origin, token: TOKEN }), null, `${JSON.stringify(origin)} must not produce a link`);
      }
    });

    it("carries the two headers RFC 8058 requires, and nothing else", () => {
      const url = unsubscribeUrl({ origin: "https://app.example.com", token: TOKEN });
      const headers = unsubscribeHeaders(url);
      assert.deepEqual(Object.keys(headers).sort(), ["List-Unsubscribe", "List-Unsubscribe-Post"]);
      assert.equal(headers["List-Unsubscribe"], `<${url}>`);
      assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    });

    it("keeps the owner's message and adds the way out below it", () => {
      const body = withUnsubscribeLine("Your service is due.", "https://app.example.com/x");
      assert.match(body, /^Your service is due\./);
      assert.match(body, /To stop receiving these emails/);
    });

    it("builds nothing from a missing url rather than a line pointing nowhere", () => {
      assert.equal(withUnsubscribeLine("Body", null), null);
      assert.equal(unsubscribeHeaders(null), null);
    });
  });

  describe("opening the link does not unsubscribe anybody", () => {
    it("asks first, because mail scanners prefetch links", async () => {
      const { response, calls } = await call("get", `?t=${encodeURIComponent(TOKEN)}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /Stop receiving these emails/);
      assert.match(response.text, /<form method="post"/, "the withdrawal has to be a POST a person makes");
      assert.deepEqual(calls.patches, [], "a GET must not write anything");
      assert.deepEqual(calls.inserts, []);
    });

    it("shows a readable page for a link an email program mangled", async () => {
      // 200 rather than 400 on purpose: a person reads this and the status is
      // invisible to them. The POST is the opposite -- see below.
      const { response, calls } = await call("get", "?t=broken");
      assert.equal(response.status, 200);
      assert.match(response.text, /This link does not work/);
      assert.match(response.text, /Reply to the email/, "they still need a way out that works");
      assert.deepEqual(calls.patches, []);
    });
  });

  describe("posting it does", () => {
    it("records the withdrawal on the contact's own row", async () => {
      const { response, calls } = await call("post", `?t=${encodeURIComponent(TOKEN)}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /Done/);
      assert.equal(calls.patches.length, 1);
      assert.equal(calls.patches[0].body.consent_status, "withdrawn");
      assert.ok(calls.patches[0].body.withdrawn_at, "the timestamp is what the sender's safe reading falls back on");
    });

    it("scopes the write by organization and lead and channel", async () => {
      // The service-role key bypasses row-level security, so these filters are
      // the tenant boundary -- and this is the only unauthenticated write in
      // Growth Studio, which is where a missing one matters most.
      const { calls } = await call("post", `?t=${encodeURIComponent(TOKEN)}`);
      const url = calls.patches[0].url;
      assert.ok(url.includes(`organization_id=eq.${ORGANIZATION_ID}`), url);
      assert.ok(url.includes(`lead_id=eq.${LEAD_ID}`), url);
      assert.ok(url.includes("channel=eq.email"), url);
    });

    it("accepts the one-click POST a mail client makes, with the token in the query", async () => {
      // RFC 8058: the client sends `List-Unsubscribe=One-Click` as the body and
      // nothing else, so the token has to be in the URI.
      const { response, calls } = await call("post", `?t=${encodeURIComponent(TOKEN)}`, {}, { "List-Unsubscribe": "One-Click" });
      assert.equal(response.status, 200);
      assert.equal(calls.patches.length, 1);
    });

    it("does not redirect, because RFC 8058 forbids it", async () => {
      const { response } = await call("post", `?t=${encodeURIComponent(TOKEN)}`);
      assert.ok(response.status < 300 || response.status >= 400, `status ${response.status} is a redirect`);
      assert.equal(response.headers.location, undefined);
    });

    it("refuses a bad token with an error status, not a 200 saying it worked", async () => {
      // A mail client shows its user "Unsubscribed" from the status. A 200 here
      // on a token that verified against nothing would report a withdrawal that
      // never happened.
      const { response, calls } = await call("post", "?t=forged");
      assert.equal(response.status, 400);
      assert.deepEqual(calls.patches, [], "nothing may be written on an unverified token");
      assert.deepEqual(calls.inserts, []);
    });

    it("says the same thing for a forged token as for an unknown one", async () => {
      // Open to anybody, so a reply that told these apart would answer
      // questions about somebody else's contact list.
      const forged = await call("post", "?t=forged");
      const [version, organization, , provided] = TOKEN.split(".");
      const swapped = await call("post", `?t=${encodeURIComponent(`${version}.${organization}.${OTHER_LEAD_ID}.${provided}`)}`);
      assert.equal(forged.response.status, swapped.response.status);
      assert.equal(forged.response.text, swapped.response.text);
    });

    it("records a withdrawal even where the original permission row is gone", async () => {
      // A row can be deleted between the send and the click, months later.
      const { response, calls } = await call("post", `?t=${encodeURIComponent(TOKEN)}`, { patchRows: [] });
      assert.equal(response.status, 200);
      assert.equal(calls.inserts.length, 1, "an update that changed nothing is not a withdrawal on file");
      assert.equal(calls.inserts[0].body.consent_status, "withdrawn");
      assert.equal(calls.inserts[0].body.organization_id, ORGANIZATION_ID);
      assert.equal(calls.inserts[0].body.channel, "email");
    });

    it("never says 'done' over a write that failed", async () => {
      for (const options of [{ patchOk: false }, { patchRows: [], insertOk: false }]) {
        const { response } = await call("post", `?t=${encodeURIComponent(TOKEN)}`, options);
        assert.notEqual(response.status, 200, "somebody told their unsubscribe worked will get the next campaign");
        assert.ok(!/^[\s\S]*<h1>Done<\/h1>/.test(response.text), response.text);
        assert.match(response.text, /not recorded/);
      }
    });

    it("says so rather than claiming success when the database is not connected", async () => {
      const { response, calls } = await call("post", `?t=${encodeURIComponent(TOKEN)}`, { configured: false });
      assert.equal(response.status, 503);
      assert.deepEqual(calls.patches, []);
      assert.match(response.text, /not recorded/);
    });
  });

  describe("what the page tells whoever opens it", () => {
    it("names no business and no email address", async () => {
      // Reachable by anybody holding the link, including whoever an email was
      // forwarded to. It confirms an action and discloses nothing about who the
      // contact is or which business mailed them.
      //
      // CORRECTED: this first asserted the organization and lead ids were
      // absent too, and failed -- because the token CONTAINS them and the
      // confirm form has to carry the token to post it back. That assertion was
      // wrong rather than the page: whoever holds the link already received
      // those ids in their own email, so the page discloses nothing new. What
      // it must never add is the address or the business, and that is what is
      // asserted.
      for (const [method, query] of [["get", `?t=${encodeURIComponent(TOKEN)}`], ["post", `?t=${encodeURIComponent(TOKEN)}`]]) {
        const { response } = await call(method, query);
        assert.ok(!response.text.includes("@"), `${method} page shows an email address: ${response.text}`);
        for (const leak of ["Spring", "campaign_email", "consent_status"]) {
          assert.ok(!response.text.includes(leak), `${method} page leaks ${leak}: ${response.text}`);
        }
      }
    });

    it("discloses nothing the holder of the link did not already have", async () => {
      // The stronger version of the above, and the one that is actually true of
      // this design: everything identifying on the page came out of the token
      // the recipient was sent.
      const { response } = await call("get", `?t=${encodeURIComponent(TOKEN)}`);
      const identifiers = response.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [];
      assert.ok(identifiers.length > 0, "no identifiers found at all; this check has gone blind");
      for (const identifier of identifiers) {
        assert.ok(TOKEN.includes(identifier), `${identifier} is on the page and not in the token the recipient holds`);
      }
    });

    it("promises only what it did", async () => {
      const { response } = await call("post", `?t=${encodeURIComponent(TOKEN)}`);
      assert.match(response.text, /Nothing else about you was changed/, "it withdrew one permission, not an account");
    });
  });
});
