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
      const body = { event_type: "check_in", privacy_mode: "manual", client_event_id: crypto.randomUUID(), captured_at: hoursAgo(3), sent_later: true };
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

    it("names and times a check-in before its first attempt", () => {
      const prepared = queue.prepare({ event_type: "check_in", latitude: 51.5 }, Date.parse("2026-10-07T09:00:00Z"));
      assert.match(prepared.client_event_id, /^[0-9a-f-]{36}$/);
      assert.equal(prepared.captured_at, "2026-10-07T09:00:00.000Z");
      assert.equal(prepared.latitude, 51.5);
    });

    it("keeps an entry while there is no connection, and sends it with the same id when there is", async () => {
      const storage = memoryStorage();
      const body = queue.prepare({ event_type: "check_in" });
      assert.equal(queue.keep(ENDPOINT, body, { storage }).kept, true);

      const offline = await queue.flush({ storage, fetch: async () => { throw new TypeError("Failed to fetch"); } });
      assert.equal(offline.waiting, 1);
      assert.equal(queue.pending({ storage }), 1, "an entry was dropped while offline");

      const sent = [];
      const online = await queue.flush({ storage, fetch: async (url, init) => { sent.push(JSON.parse(init.body)); return answer(200, { ok: true }); } });
      assert.equal(online.sent, 1);
      assert.equal(sent[0].client_event_id, body.client_event_id, "the retry carried a different id, so the server could not recognise it");
      assert.equal(sent[0].sent_later, true);
      assert.equal(queue.pending({ storage }), 0);
    });

    it("drops what the server refuses, keeps what failed on the server's side, and keeps order", async () => {
      const storage = memoryStorage();
      const first = queue.prepare({ n: 1 });
      const second = queue.prepare({ n: 2 });
      queue.keep(ENDPOINT, first, { storage });
      queue.keep(ENDPOINT, second, { storage });

      const tried = [];
      const serverDown = await queue.flush({ storage, fetch: async (url, init) => { tried.push(JSON.parse(init.body).n); return answer(503, {}); } });
      assert.deepEqual(tried, [1], "a later entry was sent while an earlier one was still waiting");
      assert.equal(serverDown.waiting, 2);

      const refused = await queue.flush({ storage, fetch: async (url, init) => answer(JSON.parse(init.body).n === 1 ? 400 : 200, { ok: true, duplicate: JSON.parse(init.body).n === 2 }) });
      assert.equal(refused.refused, 1);
      assert.equal(refused.duplicates, 1);
      assert.equal(queue.pending({ storage }), 0);
    });

    it("drops an entry older than the server will accept instead of sending it as fresh", async () => {
      const storage = memoryStorage();
      queue.keep(ENDPOINT, queue.prepare({ n: 1 }, Date.now() - 8 * 86400000), { storage });
      let called = false;
      const result = await queue.flush({ storage, fetch: async () => { called = true; return answer(200, { ok: true }); } });
      assert.equal(result.expired, 1);
      assert.equal(called, false);
      assert.equal(queue.pending({ storage }), 0);
    });

    it("says so when it cannot keep any more, rather than dropping the oldest", () => {
      const storage = memoryStorage();
      for (let index = 0; index < queue.MAX_ITEMS; index += 1) queue.keep(ENDPOINT, queue.prepare({ n: index }), { storage });
      const full = queue.keep(ENDPOINT, queue.prepare({ n: "one too many" }), { storage });
      assert.equal(full.kept, false);
      assert.equal(full.reason, "full");
      assert.equal(queue.pending({ storage }), queue.MAX_ITEMS);
    });
  });
});
