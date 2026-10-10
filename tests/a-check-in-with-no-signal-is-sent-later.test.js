"use strict";

// Field staff check in where the signal is worst. A check-in that could not be
// sent was lost: "nothing was recorded", and no record of having been there.
//
// The device now keeps it and sends it later (public/sonara-offline-queue.js),
// which means the same check-in can arrive more than once. These tests hold both
// halves: the server records one row per device-named check-in, at the time it
// happened, and the queue retries only what is worth retrying, in order.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const queue = require("../public/sonara-offline-queue.js");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const ENDPOINT = "/api/location/events";
const SCOPE = Object.freeze({ organizationId: ORG, userId: USER, employeeId: USER });

function buildApp(fake, organizationId = ORG) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const signedIn = (req, res, next) => { req.sonaraUser = { id: USER }; next(); };
  registerRoutes(app, {
    layout: ({ title, sections = [] }) => `<html><title>${title}</title>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireCustomer: signedIn,
    requireBusinessManager: signedIn,
    requireWorkspaceAccess: () => signedIn,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId, userId: USER }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" })
  });
  return app;
}

const hoursAgo = (hours) => new Date(Date.now() - hours * 3600000).toISOString();

describe("a check-in with no signal is sent later", () => {
  describe("the server records it once, at the time it happened", () => {
    let fake;
    let savedFetch;
    beforeEach(() => {
      fake = createFakeSupabase({ users: {}, tables: { location_events: [] }, ids: "uuid" });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
    });
    afterEach(() => { global.fetch = savedFetch; });

    it("records a resent check-in once and says the repeat was a duplicate", async () => {
      const app = buildApp(fake);
      const body = { event_type: "check_in", privacy_mode: "manual", client_event_id: crypto.randomUUID(), captured_at: hoursAgo(3), sent_later: true,
        capture_user_id: USER, capture_organization_id: ORG };
      const first = await request(app).post(ENDPOINT).send(body);
      const again = await request(app).post(ENDPOINT).send(body);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(again.status, 200);
      assert.equal(again.body.duplicate, true, "a repeat was not reported as a duplicate");
      const rows = fake.rows("location_events");
      assert.equal(rows.length, 1, `a resent check-in was recorded ${rows.length} times`);
      assert.equal(rows[0].captured_at, new Date(body.captured_at).toISOString(), "the check-in was recorded at the time it arrived, not when it happened");
      assert.equal(rows[0].metadata.sent_later, true);
    });

    it("rejects old unbound and forged delayed check-ins before persistence", async () => {
      const app = buildApp(fake);
      const base = { event_type: "check_in", privacy_mode: "manual", sent_later: true,
        client_event_id: crypto.randomUUID(), captured_at: hoursAgo(1) };
      for (const input of [
        base,
        { ...base, capture_user_id: USER },
        { ...base, capture_organization_id: ORG },
        { ...base, capture_user_id: OTHER_ORG, capture_organization_id: ORG },
        { ...base, capture_user_id: USER, capture_organization_id: OTHER_ORG }
      ]) {
        const response = await request(app).post(ENDPOINT).send(input);
        assert.equal(response.status, 403, JSON.stringify(response.body));
        assert.equal(response.body.code, "check_in_scope_changed");
      }
      assert.equal(fake.rows("location_events").length, 0);
    });

    it("does not turn an unreadable database receipt into a duplicate confirmation", async () => {
      const installed = global.fetch;
      let corrupt = true;
      global.fetch = async (url, options) => {
        const response = await installed(url, options);
        if (corrupt && options?.method === "POST" && String(url).includes("location_events")) {
          return { ok: true, json: async () => { throw new Error("Truncated response"); } };
        }
        return response;
      };
      const body = { event_type: "check_in", privacy_mode: "manual", client_event_id: crypto.randomUUID() };
      const app = buildApp(fake);
      const uncertain = await request(app).post(ENDPOINT).send(body);
      assert.equal(uncertain.body.ok, false);
      assert.equal(uncertain.body.code, "insert_receipt_unreadable");
      corrupt = false;
      const retried = await request(app).post(ENDPOINT).send(body);
      assert.equal(retried.body.duplicate, true);
      assert.equal(fake.rows("location_events").length, 1);
    });

    it("keeps the same id apart in two businesses", async () => {
      const id = crypto.randomUUID();
      await request(buildApp(fake, ORG)).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual", client_event_id: id });
      await request(buildApp(fake, OTHER_ORG)).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual", client_event_id: id });
      assert.equal(fake.rows("location_events").length, 2, "one business's check-in suppressed another's");
    });

    it("refuses a time outside the window rather than storing it as true", async () => {
      const app = buildApp(fake);
      for (const captured of [new Date(Date.now() - 8 * 86400000).toISOString(), new Date(Date.now() + 3600000).toISOString(), "yesterday-ish"]) {
        const refused = await request(app).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual", client_event_id: crypto.randomUUID(), captured_at: captured });
        assert.equal(refused.status, 400, `${captured} was accepted`);
        assert.equal(refused.body.code, "captured_at_out_of_range");
      }
      const badId = await request(app).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual", client_event_id: "not-a-uuid" });
      assert.equal(badId.body.code, "client_event_id_invalid");
      assert.equal(fake.rows("location_events").length, 0);
    });

    it("stores metadata a caller sends as values, never as a prototype", async () => {
      const done = await request(buildApp(fake)).post(ENDPOINT).set("content-type", "application/json")
        .send('{"event_type":"check_in","privacy_mode":"manual","metadata":{"__proto__":{"polluted":true},"note":"van 3","api_key":"x"}}');
      assert.equal(done.status, 200, JSON.stringify(done.body));
      const [row] = fake.rows("location_events");
      assert.equal(Object.getPrototypeOf(row.metadata), Object.prototype, "a posted __proto__ replaced the metadata's prototype");
      assert.equal(row.metadata.polluted, undefined);
      assert.equal(row.metadata.note, "van 3");
      assert.equal(row.metadata.api_key, undefined, "a secret-shaped key was kept");
    });

    it("refuses captured user or workspace changes before any write", async () => {
      for (const scope of [{ capture_user_id: OTHER_ORG }, { capture_organization_id: OTHER_ORG }]) {
        const response = await request(buildApp(fake)).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual", ...scope });
        assert.equal(response.status, 403);
        assert.equal(response.body.code, "check_in_scope_changed");
      }
      assert.equal(fake.rows("location_events").length, 0);
    });

    it("still takes a check-in that names no id, as it always did", async () => {
      const done = await request(buildApp(fake)).post(ENDPOINT).send({ event_type: "check_in", privacy_mode: "manual" });
      assert.equal(done.status, 200);
      assert.equal(fake.rows("location_events")[0].client_event_id, null);
    });
  });

  describe("the device keeps it and retries only what is worth retrying", () => {
    function memoryStorage() {
      const data = new Map();
      return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
    }
    const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    const prepared = (body, now) => queue.prepare({ capture_user_id: USER, capture_organization_id: ORG, ...body }, now);

    it("names and times a check-in before its first attempt", () => {
      const sample = prepared({ event_type: "check_in", latitude: 51.5 }, Date.parse("2026-10-07T09:00:00Z"));
      assert.match(sample.client_event_id, /^[0-9a-f-]{36}$/);
      assert.equal(sample.captured_at, "2026-10-07T09:00:00.000Z");
      assert.equal(sample.latitude, 51.5);
    });

    it("partitions queued check-ins by workspace and signed-in user", async () => {
      const storage = memoryStorage();
      const firstScope = { organizationId: ORG, userId: USER, employeeId: USER };
      const secondScope = { organizationId: OTHER_ORG, userId: OTHER_ORG, employeeId: OTHER_ORG };
      const first = prepared({ event_type: "check_in", capture_organization_id: ORG, capture_user_id: USER, employee_id: USER });
      const second = prepared({ event_type: "check_in", capture_organization_id: OTHER_ORG, capture_user_id: OTHER_ORG, employee_id: OTHER_ORG });
      assert.equal(queue.keep(ENDPOINT, first, { storage, scope: firstScope }).kept, true);
      assert.equal(queue.keep(ENDPOINT, second, { storage, scope: secondScope }).kept, true);
      assert.equal(queue.pending({ storage, scope: firstScope }), 1);
      assert.equal(queue.pending({ storage, scope: secondScope }), 1);
      assert.equal(queue.pending({ storage }), 0, "account-scoped entries leaked into the legacy queue");
      const sent = [];
      await Promise.all([
        queue.flush({ storage, scope: firstScope, fetch: async (_url, init) => { sent.push(JSON.parse(init.body).capture_user_id); return answer(200, { ok: true }); } }),
        queue.flush({ storage, scope: secondScope, fetch: async (_url, init) => { sent.push(JSON.parse(init.body).capture_user_id); return answer(200, { ok: true }); } })
      ]);
      assert.deepEqual(sent.sort(), [USER, OTHER_ORG].sort());
    });

    it("shows legacy and scope-blocked entries for explicit review, without replaying them", async () => {
      const storage = memoryStorage();
      const scope = { organizationId: ORG, userId: USER, employeeId: USER };
      const legacy = prepared({ event_type: "check_in" });
      const blocked = prepared({ event_type: "check_in", capture_organization_id: OTHER_ORG, capture_user_id: OTHER_ORG, employee_id: OTHER_ORG });
      storage.setItem(queue.STORAGE_KEY, JSON.stringify([{ endpoint: ENDPOINT, body: legacy }]));
      storage.setItem(queue.SCOPED_STORAGE_PREFIX + "." + ORG + "." + USER,
        JSON.stringify([{ endpoint: ENDPOINT, body: blocked }]));
      let requests = 0;
      const result = await queue.flush({ storage, scope, fetch: async () => { requests += 1; return answer(200, { ok: true }); } });
      assert.equal(requests, 0);
      assert.equal(result.authenticationRequired, true);
      const entries = queue.review({ storage, scope }).entries;
      assert.deepEqual(entries.map((entry) => entry.source).sort(), ["account", "legacy"]);
      assert.ok(entries.every((entry) => entry.id), "every review item needs an explicit discard token");
      const legacyEntry = entries.find((entry) => entry.source === "legacy");
      const blockedEntry = entries.find((entry) => entry.source === "account");
      assert.equal(legacyEntry.capturedAt, null, "another person's check-in timestamp was disclosed");
      assert.equal(blockedEntry.capturedAt, null, "blocked check-in timestamp was disclosed");
      assert.equal(legacyEntry.eventType, "check_in", "untrusted event type was exposed");
      assert.equal(queue.discard(legacyEntry.id, { storage, scope, source: "legacy" }).discarded, true);
      assert.equal(queue.discard(blockedEntry.id, { storage, scope, source: "account" }).discarded, true);
      assert.equal(queue.review({ storage, scope }).entries.length, 0);
    });

    it("never saves or replays an unbound queue without a verified scope", async () => {
      const storage = memoryStorage();
      const body = prepared({ event_type: "check_in" });
      assert.equal(queue.keep(ENDPOINT, body, { storage }).reason, "scope_required");
      storage.setItem(queue.STORAGE_KEY, JSON.stringify([{ endpoint: ENDPOINT, body }]));
      let sent = false;
      const result = await queue.flush({ storage, fetch: async () => { sent = true; return answer(200, { ok: true }); } });
      assert.equal(result.scopeRequired, true);
      assert.equal(queue.pending({ storage }), 0);
      assert.equal(sent, false);
      assert.equal(queue.review({ storage, scope: SCOPE }).entries[0].source, "legacy");
      assert.equal(JSON.parse(storage.getItem(queue.STORAGE_KEY)).length, 1);
    });

    it("refuses capture metadata missing inside a valid account partition", async () => {
      const storage = memoryStorage();
      const incomplete = prepared({ event_type: "check_in" });
      delete incomplete.capture_user_id;
      assert.equal(queue.keep(ENDPOINT, incomplete, { storage, scope: SCOPE }).reason, "scope_mismatch");
      const key = queue.SCOPED_STORAGE_PREFIX + "." + ORG + "." + USER;
      storage.setItem(key, JSON.stringify([{ endpoint: ENDPOINT, body: incomplete }]));
      let sent = false;
      const result = await queue.flush({ storage, scope: SCOPE, fetch: async () => {
        sent = true; return answer(200, { ok: true });
      } });
      assert.equal(result.authenticationRequired, true);
      assert.equal(sent, false);
      assert.equal(queue.pending({ storage, scope: SCOPE }), 1);
      assert.equal(queue.review({ storage, scope: SCOPE }).entries[0].reason, "scope_metadata_mismatch");
    });

    it("keeps an entry while there is no connection, and sends it with the same id when there is", async () => {
      const storage = memoryStorage();
      const body = prepared({ event_type: "check_in" });
      assert.equal(queue.keep(ENDPOINT, body, { storage, scope: SCOPE }).kept, true);

      const offline = await queue.flush({ storage, scope: SCOPE, fetch: async () => { throw new TypeError("Failed to fetch"); } });
      assert.equal(offline.waiting, 1);
      assert.equal(queue.pending({ storage, scope: SCOPE }), 1, "an entry was dropped while offline");

      const sent = [];
      const online = await queue.flush({ storage, scope: SCOPE, fetch: async (url, init) => { sent.push(JSON.parse(init.body)); return answer(200, { ok: true }); } });
      assert.equal(online.sent, 1);
      assert.equal(sent[0].client_event_id, body.client_event_id, "the retry carried a different id, so the server could not recognise it");
      assert.equal(sent[0].sent_later, true);
      assert.equal(queue.pending({ storage, scope: SCOPE }), 0);
    });

    it("drops what the server refuses, keeps what failed on the server's side, and keeps order", async () => {
      const storage = memoryStorage();
      const first = prepared({ n: 1 });
      const second = prepared({ n: 2 });
      queue.keep(ENDPOINT, first, { storage, scope: SCOPE });
      queue.keep(ENDPOINT, second, { storage, scope: SCOPE });

      const tried = [];
      const serverDown = await queue.flush({ storage, scope: SCOPE, fetch: async (url, init) => { tried.push(JSON.parse(init.body).n); return answer(503, {}); } });
      assert.deepEqual(tried, [1], "a later entry was sent while an earlier one was still waiting");
      assert.equal(serverDown.waiting, 2);

      const refused = await queue.flush({ storage, scope: SCOPE, fetch: async (url, init) => answer(JSON.parse(init.body).n === 1 ? 400 : 200, { ok: true, duplicate: JSON.parse(init.body).n === 2 }) });
      assert.equal(refused.refused, 1);
      assert.equal(refused.duplicates, 1);
      assert.equal(queue.pending({ storage, scope: SCOPE }), 0);
    });

    it("does not replay another employee's saved check-in", async () => {
      const storage = memoryStorage();
      const correctScope = { employeeId: USER, userId: USER, organizationId: ORG };
      queue.keep(ENDPOINT, prepared({ employee_id: USER, capture_user_id: USER, capture_organization_id: ORG }), { storage, scope: correctScope });
      let requests = 0;
      const fetch = async () => { requests += 1; return answer(200, { ok: true }); };
      const wrongEmployee = await queue.flush({ storage, scope: { employeeId: OTHER_ORG, userId: USER, organizationId: ORG }, fetch });
      assert.equal(wrongEmployee.authenticationRequired, true);
      assert.equal(wrongEmployee.waiting, 1);
      const otherUser = await queue.flush({ storage, scope: { employeeId: USER, userId: OTHER_ORG, organizationId: ORG }, fetch });
      assert.equal(otherUser.authenticationRequired, false);
      assert.equal(otherUser.waiting, 0, "another user's queue should not be visible");
      const otherWorkspace = await queue.flush({ storage, scope: { employeeId: USER, userId: USER, organizationId: OTHER_ORG }, fetch });
      assert.equal(otherWorkspace.waiting, 0, "another workspace's queue should not be visible");
      assert.equal(requests, 0);
      const done = await queue.flush({ storage, scope: correctScope, fetch });
      assert.equal(done.sent, 1);
    });

    it("never sends a stored check-in to an unexpected destination", async () => {
      const storage = memoryStorage();
      const body = prepared({ event_type: "check_in" });
      assert.equal(queue.keep("https://example.invalid/collect", body, { storage }).kept, false);
      storage.setItem(queue.SCOPED_STORAGE_PREFIX + "." + ORG + "." + USER,
        JSON.stringify([{ endpoint: "https://example.invalid/collect", body }]));
      let sent = false;
      const result = await queue.flush({ storage, scope: SCOPE, fetch: async () => { sent = true; return answer(200, { ok: true }); } });
      assert.equal(sent, false);
      assert.equal(result.refused, 1);
    });

    it("requires an explicit acceptance receipt and keeps ambiguous responses", async () => {
      for (const response of [answer(200, {}), answer(200, { ok: false }), answer(200, { ok: "true" }),
        { ...answer(200, {}), json: async () => { throw new Error("HTML login"); } },
        { ...answer(200, { ok: true }), redirected: true }, answer(401, {}), answer(403, {}), answer(408, {}), answer(425, {})]) {
        const storage = memoryStorage();
        queue.keep(ENDPOINT, prepared({ event_type: "check_in" }), { storage, scope: SCOPE });
        const result = await queue.flush({ storage, scope: SCOPE, fetch: async () => response });
        assert.equal(result.sent, 0);
        assert.equal(result.refused, 0);
        assert.equal(result.waiting, 1);
        assert.equal(queue.pending({ storage, scope: SCOPE }), 1);
      }
    });

    it("honors both Retry-After forms before retrying the same event", async () => {
      for (const retryAfter of ["60", new Date(Date.now() + 60000).toUTCString()]) {
        const now = Date.now();
        const storage = memoryStorage();
        const body = prepared({ event_type: "check_in" }, now);
        queue.keep(ENDPOINT, body, { storage, scope: SCOPE, now });
        const limited = await queue.flush({ storage, scope: SCOPE, now, fetch: async () => ({ ...answer(429, {}), headers: { get: () => retryAfter } }) });
        assert.equal(limited.waiting, 1);
        let attempts = 0;
        const fetch = async (_url, init) => {
          attempts += 1;
          assert.equal(init.redirect, "error");
          assert.equal(JSON.parse(init.body).client_event_id, body.client_event_id);
          return answer(200, { ok: true });
        };
        await queue.flush({ storage, scope: SCOPE, now: now + 1000, fetch });
        assert.equal(attempts, 0);
        const done = await queue.flush({ storage, scope: SCOPE, now: now + 61000, fetch });
        assert.equal(attempts, 1);
        assert.equal(done.sent, 1);
      }
    });

    it("shares overlapping retries and preserves an entry saved while a request is pending", async () => {
      const storage = memoryStorage();
      queue.keep(ENDPOINT, prepared({ n: 1 }), { storage, scope: SCOPE });
      let resolve;
      let requests = 0;
      const fetch = () => { requests += 1; return new Promise((done) => { resolve = done; }); };
      const first = queue.flush({ storage, scope: SCOPE, fetch });
      const overlap = queue.flush({ storage, scope: SCOPE, fetch });
      assert.equal(first, overlap);
      await Promise.resolve();
      queue.keep(ENDPOINT, prepared({ n: 2 }), { storage, scope: SCOPE });
      resolve(answer(200, { ok: true }));
      const result = await first;
      assert.equal(requests, 1);
      assert.equal(result.sent, 1);
      assert.equal(result.waiting, 1);
      assert.equal(JSON.parse(storage.getItem(queue.SCOPED_STORAGE_PREFIX + "." + ORG + "." + USER))[0].body.n, 2);
    });

    it("does not claim the queue was cleared when storage refuses the receipt update", async () => {
      const storage = memoryStorage();
      queue.keep(ENDPOINT, prepared({ n: 1 }), { storage, scope: SCOPE });
      storage.setItem = () => { throw new Error("Storage unavailable"); };
      const result = await queue.flush({ storage, scope: SCOPE, fetch: async () => answer(200, { ok: true }) });
      assert.equal(result.sent, 1);
      assert.equal(result.storageFailed, true);
      assert.equal(result.waiting, 1);
    });

    it("drops an entry older than the server will accept instead of sending it as fresh", async () => {
      const storage = memoryStorage();
      queue.keep(ENDPOINT, prepared({ n: 1 }, Date.now() - 8 * 86400000), { storage, scope: SCOPE });
      let called = false;
      const result = await queue.flush({ storage, scope: SCOPE, fetch: async () => { called = true; return answer(200, { ok: true }); } });
      assert.equal(result.expired, 1);
      assert.equal(called, false);
      assert.equal(queue.pending({ storage, scope: SCOPE }), 0);
    });

    it("says so when it cannot keep any more, rather than dropping the oldest", () => {
      const storage = memoryStorage();
      for (let index = 0; index < queue.MAX_ITEMS; index += 1) queue.keep(ENDPOINT, prepared({ n: index }), { storage, scope: SCOPE });
      const full = queue.keep(ENDPOINT, prepared({ n: "one too many" }), { storage, scope: SCOPE });
      assert.equal(full.kept, false);
      assert.equal(full.reason, "full");
      assert.equal(queue.pending({ storage, scope: SCOPE }), queue.MAX_ITEMS);
    });
  });
});
