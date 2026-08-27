"use strict";

const assert = require("node:assert/strict");
const store = require("../lib/sonara-push-subscriptions.cjs");
const push = require("../lib/sonara-web-push.cjs");

const KEYS = push.generateVapidKeys();

function deps(extra = {}) {
  return {
    getEnv: (name) => ({
      VAPID_PUBLIC_KEY: KEYS.publicKey,
      VAPID_PRIVATE_KEY: KEYS.privateKey,
      VAPID_SUBJECT: "mailto:owner@example.com",
      ...extra
    })[name],
    serviceRoleHeaders: () => ({ apikey: "service-role", Authorization: "Bearer service-role" }),
    supabaseUrl: "https://project.supabase.co"
  };
}

// A real P-256 point and a real 16-byte secret, so the length checks are
// exercised against something valid rather than against a string of the right
// shape.
const VALID = {
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  endpoint: "https://push.example.net/send/abc"
};

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe("keeping the browsers that agreed", () => {
  describe("consent", () => {
    it("keeps only topics this version knows about, rather than losing the whole subscription", () => {
      // A browser sending one topic we renamed should still get the others.
      assert.deepEqual(store.knownTopics(["invoice_paid", "nonsense", "booking_made"]), ["invoice_paid", "booking_made"]);
    });

    it("deduplicates", () => {
      assert.deepEqual(store.knownTopics(["invoice_paid", "invoice_paid"]), ["invoice_paid"]);
    });

    it("treats anything that is not a list as no topics", () => {
      assert.deepEqual(store.knownTopics(null), []);
      assert.deepEqual(store.knownTopics("invoice_paid"), []);
    });

    // The default that matters. AGENTS.md requires alerts to be explicitly
    // user-controlled, and an empty list is the safe reading of "granted
    // permission and chose nothing".
    it("stores no topics rather than all of them when none were chosen", async () => {
      let written = null;
      const result = await store.save(deps(), { organizationId: "org-1", ...VALID }, async (url, options) => {
        written = JSON.parse(options.body);
        return jsonResponse([{ id: "row" }]);
      });
      assert.equal(result.ok, true);
      assert.deepEqual(written.topics, []);
    });

    it("sends nothing to a subscription that chose nothing", async () => {
      // The query itself has to filter, not the sender: a subscription with no
      // topics must not come back for any topic.
      let asked = "";
      await store.forTopic(deps(), "org-1", "invoice_paid", async (url) => {
        asked = url;
        return jsonResponse([]);
      });
      assert.match(asked, /topics=cs\./);
    });
  });

  describe("storing one", () => {
    it("refuses an endpoint that is not https before writing anything", async () => {
      const result = await store.save(deps(), { organizationId: "org-1", ...VALID, endpoint: "http://push.example.net/x" }, async () => {
        throw new Error("should not have been called");
      });
      assert.equal(result.code, "bad_endpoint");
    });

    it("refuses keys that are not the right size, with a message rather than a Postgres error", async () => {
      const shortKey = await store.save(deps(), { organizationId: "org-1", ...VALID, p256dh: "tooshort" }, async () => {
        throw new Error("should not have been called");
      });
      assert.equal(shortKey.code, "bad_key");
      const shortAuth = await store.save(deps(), { organizationId: "org-1", ...VALID, auth: "short" }, async () => {
        throw new Error("should not have been called");
      });
      assert.equal(shortAuth.code, "bad_auth");
    });

    // Without this a person who granted permission twice hears everything
    // twice, and nothing anywhere reports it.
    it("updates rather than duplicating when the same browser subscribes again", async () => {
      let seen = null;
      await store.save(deps(), { organizationId: "org-1", ...VALID }, async (url, options) => {
        seen = { url, prefer: options.headers.Prefer };
        return jsonResponse([{ id: "row" }]);
      });
      assert.match(seen.url, /on_conflict=endpoint/);
      assert.match(seen.prefer, /merge-duplicates/);
    });

    it("truncates a browser-supplied label rather than refusing it", async () => {
      let written = null;
      await store.save(deps(), { organizationId: "org-1", ...VALID, label: "x".repeat(500) }, async (url, options) => {
        written = JSON.parse(options.body);
        return jsonResponse([{ id: "row" }]);
      });
      assert.equal(written.label.length, 120);
    });
  });

  describe("reading who is subscribed", () => {
    it("does not report a failed read as nobody being subscribed", async () => {
      // "Nobody is subscribed" told to somebody with fifty subscribers is the
      // shape of this bug.
      const failed = await store.forTopic(deps(), "org-1", "invoice_paid", async () => {
        throw new Error("network down");
      });
      assert.equal(failed.ok, false);
      assert.equal(failed.code, "unreadable");

      const empty = await store.forTopic(deps(), "org-1", "invoice_paid", async () => jsonResponse([]));
      assert.equal(empty.ok, true);
      assert.deepEqual(empty.rows, []);
    });

    it("refuses a topic nobody can have subscribed to", async () => {
      const result = await store.forTopic(deps(), "org-1", "made_up", async () => {
        throw new Error("should not have been called");
      });
      assert.equal(result.code, "unknown_topic");
    });

    it("scopes the read to the organization", async () => {
      let asked = "";
      await store.forTopic(deps(), "org-1", "invoice_paid", async (url) => {
        asked = url;
        return jsonResponse([]);
      });
      assert.match(asked, /organization_id=eq\.org-1/);
    });
  });

  describe("notifying", () => {
    const subscribers = [
      { id: "a", endpoint: "https://push.example.net/a", ...VALID, endpoint: "https://push.example.net/a" },
      { id: "b", endpoint: "https://push.example.net/b", p256dh: VALID.p256dh, auth: VALID.auth }
    ];

    function router({ pushStatus }) {
      return async (url, options) => {
        if (String(url).includes("supabase.co")) {
          if (options?.method === "DELETE") return jsonResponse({}, { status: 204 });
          return jsonResponse(subscribers);
        }
        return { ok: pushStatus(url) < 400, status: pushStatus(url) };
      };
    }

    it("does not send when push is not configured", async () => {
      const result = await store.notify({ ...deps(), getEnv: () => undefined }, { organizationId: "org-1", topic: "invoice_paid", payload: "x" }, {
        fetchImpl: async () => { throw new Error("should not have been called"); }
      });
      assert.equal(result.code, "setup_required");
    });

    it("reports sending, removing and failing as three different facts", async () => {
      const result = await store.notify(deps(), { organizationId: "org-1", topic: "invoice_paid", payload: "hello" }, {
        fetchImpl: router({ pushStatus: (url) => (String(url).endsWith("/a") ? 201 : 410) })
      });
      assert.equal(result.ok, true);
      assert.equal(result.considered, 2);
      assert.equal(result.sent, 1);
      assert.equal(result.removed, 1);
      assert.deepEqual(result.failures, []);
    });

    // The distinction the whole module turns on. Deleting on a 429 loses live
    // subscribers to somebody else's outage.
    it("deletes a subscription the push service says is gone, and only then", async () => {
      const deleted = [];
      const fetchImpl = async (url, options) => {
        if (String(url).includes("supabase.co")) {
          if (options?.method === "DELETE") { deleted.push(url); return jsonResponse({}, { status: 204 }); }
          return jsonResponse(subscribers);
        }
        return { ok: false, status: 429 };
      };
      const result = await store.notify(deps(), { organizationId: "org-1", topic: "invoice_paid", payload: "x" }, { fetchImpl });
      assert.equal(deleted.length, 0, "a busy push service must not cost a live subscriber");
      assert.equal(result.removed, 0);
      assert.equal(result.failures.length, 2);
      assert.equal(result.failures[0].code, "retry_later");
    });

    it("does not delete when the push service could not be reached at all", async () => {
      const deleted = [];
      const fetchImpl = async (url, options) => {
        if (String(url).includes("supabase.co")) {
          if (options?.method === "DELETE") { deleted.push(url); return jsonResponse({}, { status: 204 }); }
          return jsonResponse(subscribers);
        }
        throw new Error("network down");
      };
      const result = await store.notify(deps(), { organizationId: "org-1", topic: "invoice_paid", payload: "x" }, { fetchImpl });
      assert.equal(deleted.length, 0);
      assert.equal(result.failures.every((failure) => failure.code === "unreachable"), true);
    });

    it("does not report 'sent to nobody' when it could not read who is subscribed", async () => {
      const result = await store.notify(deps(), { organizationId: "org-1", topic: "invoice_paid", payload: "x" }, {
        fetchImpl: async (url) => {
          if (String(url).includes("supabase.co")) throw new Error("read failed");
          throw new Error("should not have reached the push service");
        }
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "unreadable");
      assert.equal(result.sent, undefined);
    });
  });
});
