"use strict";

// Uploaded files are the first thing this application stores that is not a row,
// and the tenant boundary has to reach them the same way it reaches everything
// else. Every read here uses the service-role key, which bypasses row level
// security — so the `organization_id` filter *is* the boundary, and for files
// that means the organization has to be in the path.

const assert = require("node:assert/strict");
const storage = require("../lib/sonara-file-storage.cjs");

const CONFIG = { url: "https://project.supabase.co", serviceRoleKey: "service-role-secret" };
const ORG = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

/** A storage service that records what it was asked and answers as told. */
function storeThat(answer) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: answer.ok !== false,
      status: answer.status || 200,
      json: async () => answer.body ?? {}
    };
  };
  return { fetchImpl, calls };
}

describe("an uploaded file", () => {
  describe("has the workspace in its path", () => {
    it("puts the organization first, so a path cannot address another tenant", () => {
      const path = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "kitchen.jpg" });
      assert.ok(path.startsWith(`${ORG}/`), path);
      assert.match(path, /^[0-9a-f-]{36}\/photo\/[0-9a-f-]{36}-kitchen\.jpg$/i);
    });

    it("refuses an organization that is not a real id", () => {
      // That value becomes the first path segment. Anything else is addressing
      // a place this cannot reason about.
      for (const bad of ["", "acme", "..", "../..", null, undefined, "1"]) {
        assert.equal(storage.pathFor({ organizationId: bad, kind: "photo", filename: "a.jpg" }), null, String(bad));
      }
    });

    it("gives two files of the same name different paths", () => {
      // Two people uploading photo.jpg on the same day must not overwrite each
      // other, which is also why x-upsert is never true.
      const first = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "photo.jpg" });
      const second = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "photo.jpg" });
      assert.notEqual(first, second);
    });

    it("rebuilds a filename that tried to escape", () => {
      const path = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "../../../etc/passwd" });
      assert.ok(path.endsWith("-passwd"), path);
      assert.equal(path.split("/").length, 3, "no extra segments can be introduced by a filename");
    });

    it("rebuilds a kind that tried to escape", () => {
      const path = storage.pathFor({ organizationId: ORG, kind: "../secrets", filename: "a.jpg" });
      assert.equal(path.split("/")[1], "secrets");
    });
  });

  describe("cannot be read by a workspace that does not own it", () => {
    it("refuses to sign a link for another workspace's file", () => {
      const mine = storage.pathFor({ organizationId: OTHER, kind: "photo", filename: "theirs.jpg" });
      return storage.signedUrl(CONFIG, { organizationId: ORG, path: mine }).then((answer) => {
        assert.equal(answer.ok, false);
        assert.equal(answer.code, "not_yours");
      });
    });

    it("refuses to delete another workspace's file", async () => {
      const theirs = storage.pathFor({ organizationId: OTHER, kind: "photo", filename: "theirs.jpg" });
      const answer = await storage.remove(CONFIG, { organizationId: ORG, path: theirs });
      assert.equal(answer.code, "not_yours");
    });

    it("refuses a path that merely starts with something similar", async () => {
      // `1111.../x` and `11111111-2222-.../x` must not be confusable, which is
      // why the check is on the organization *plus the separator*.
      const answer = await storage.signedUrl(CONFIG, { organizationId: ORG, path: `${ORG}-extra/photo/a.jpg` });
      assert.equal(answer.code, "not_yours");
    });
  });

  describe("goes where it says it goes", () => {
    it("posts the bytes to the bucket with the service key", async () => {
      const { fetchImpl, calls } = storeThat({ ok: true });
      const bytes = Buffer.from([1, 2, 3, 4]);
      const answer = await storage.put(
        CONFIG,
        { organizationId: ORG, kind: "photo", filename: "a.jpg", contentType: "image/jpeg", bytes },
        { fetchImpl }
      );
      assert.equal(answer.ok, true);
      assert.equal(answer.bytes, 4);

      const call = calls[0];
      assert.match(call.url, /\/storage\/v1\/object\/sonara-uploads\//);
      assert.ok(call.url.includes(ORG), "the organization has to be in the stored path");
      assert.equal(call.options.headers.Authorization, "Bearer service-role-secret");
      assert.equal(call.options.headers["content-type"], "image/jpeg");
      assert.deepEqual(call.options.body, bytes);
    });

    it("never overwrites", async () => {
      const { fetchImpl, calls } = storeThat({ ok: true });
      await storage.put(CONFIG, { organizationId: ORG, kind: "photo", filename: "a.jpg", bytes: Buffer.from([1]) }, { fetchImpl });
      assert.equal(calls[0].options.headers["x-upsert"], "false");
    });

    it("refuses a file with nothing in it", async () => {
      const answer = await storage.put(CONFIG, { organizationId: ORG, kind: "photo", filename: "a.jpg", bytes: Buffer.alloc(0) });
      assert.equal(answer.code, "empty");
    });

    it("joins the signed path onto the storage URL, because the API returns a path", async () => {
      const { fetchImpl } = storeThat({ ok: true, body: { signedURL: "/object/sign/sonara-uploads/x?token=abc" } });
      const path = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "a.jpg" });
      const answer = await storage.signedUrl(CONFIG, { organizationId: ORG, path }, { fetchImpl });
      assert.equal(answer.ok, true);
      assert.equal(answer.url, "https://project.supabase.co/storage/v1/object/sign/sonara-uploads/x?token=abc");
    });

    it("bounds how long a link lasts", async () => {
      const { fetchImpl, calls } = storeThat({ ok: true, body: { signedURL: "/x" } });
      const path = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "a.jpg" });
      await storage.signedUrl(CONFIG, { organizationId: ORG, path, seconds: 999999 }, { fetchImpl });
      assert.equal(JSON.parse(calls[0].options.body).expiresIn, 3600, "a link pasted into a chat must not be a lasting way in");

      const { fetchImpl: second, calls: shortCalls } = storeThat({ ok: true, body: { signedURL: "/x" } });
      await storage.signedUrl(CONFIG, { organizationId: ORG, path, seconds: 1 }, { fetchImpl: second });
      assert.equal(JSON.parse(shortCalls[0].options.body).expiresIn, 30);
    });
  });

  describe("says what went wrong without saying too much", () => {
    it("reports setup-required rather than failing when nothing is configured", async () => {
      const answer = await storage.put({}, { organizationId: ORG, kind: "photo", filename: "a.jpg", bytes: Buffer.from([1]) });
      assert.equal(answer.code, "setup_required");
      assert.match(answer.problem, /SUPABASE_URL/);
    });

    it("says the bucket has to be private, because it cannot check", async () => {
      // A public bucket makes every signed link pointless, and nothing here can
      // see the policy. Stated rather than assumed.
      const readiness = storage.storageReadiness(CONFIG);
      assert.match(readiness.assumes, /private/);
    });

    it("never passes the store's own error body through", async () => {
      const { fetchImpl } = storeThat({ ok: false, status: 400, body: { message: "bad key service-role-secret at https://project.supabase.co" } });
      const answer = await storage.put(CONFIG, { organizationId: ORG, kind: "photo", filename: "a.jpg", bytes: Buffer.from([1]) }, { fetchImpl });
      assert.equal(answer.ok, false);
      assert.doesNotMatch(answer.problem, /service-role-secret/);
      assert.doesNotMatch(answer.problem, /supabase\.co/);
      assert.match(answer.problem, /400/, "the status is useful and safe");
    });

    it("treats a 200 with no link as a failure", async () => {
      // Otherwise a page gets an empty href and calls it a working download.
      const { fetchImpl } = storeThat({ ok: true, body: {} });
      const path = storage.pathFor({ organizationId: ORG, kind: "photo", filename: "a.jpg" });
      const answer = await storage.signedUrl(CONFIG, { organizationId: ORG, path }, { fetchImpl });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "no_link");
    });

    it("does not throw when the store cannot be reached", async () => {
      const fetchImpl = async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.1:443");
      };
      const answer = await storage.put(CONFIG, { organizationId: ORG, kind: "photo", filename: "a.jpg", bytes: Buffer.from([1]) }, { fetchImpl });
      assert.equal(answer.code, "unreachable");
      assert.doesNotMatch(answer.problem, /10\.0\.0\.1/);
    });
  });
});
