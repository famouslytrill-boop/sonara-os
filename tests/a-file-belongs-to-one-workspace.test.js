"use strict";

// Attaching a file to an asset is the first thing this application stores that
// is not a row, and the tenant boundary has to reach it the same way.
//
// Two properties are worth more than the happy path:
//
//   1. **The row is read filtered on the organization**, not fetched and then
//      checked. A fetch-then-check leaves a window where somebody deletes the
//      check and the query still looks right.
//   2. **Storage is written before the row is.** The other order produces an
//      asset whose download button 404s for ever, and it is the tempting order
//      because it makes the happy path one line shorter.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const registerAssetFileRoutes = require("../routes/sonara-asset-file-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

function assetRow(metadata = {}) {
  return { id: ASSET_ID, title: "Cover art", metadata };
}

describe("a file belongs to one workspace", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  function buildApp({ organization = { ok: true, organizationId: ORGANIZATION_ID }, serviceRoleKey = "server-only" } = {}) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    registerAssetFileRoutes(app, {
      layout: (title, body) => `<html><title>${title}</title>${body}</html>`,
      brandCard: (t, b, actions = []) => `<article><h2>${t}</h2><div>${b}</div>${actions.join("")}</article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
      requireCustomer: (req, res, next) => {
        req.sonaraUser = { id: USER_ID };
        return next();
      },
      getCustomerPrimaryOrganization: async () => organization,
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey }),
      supabaseHeaders: () => ({})
    });
    return app;
  }

  /**
   * Records every call and answers from a script.
   *
   * Both PostgREST and Storage go through `fetch`, so one recorder sees the
   * whole conversation -- including its order, which is half of what these
   * tests are about.
   */
  function recording({ rows = [assetRow()], storageOk = true, patchOk = true, signed = "/object/sign/x?token=t" } = {}) {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const href = String(url);
      const method = (options.method || "GET").toUpperCase();
      calls.push({ href, method, body: options.body });

      if (href.includes("/rest/v1/")) {
        const ok = method === "PATCH" ? patchOk : true;
        return { ok, status: ok ? 200 : 500, json: async () => rows };
      }
      if (href.includes("/storage/v1/object/sign/")) {
        return { ok: true, status: 200, json: async () => ({ signedURL: signed }) };
      }
      if (href.includes("/storage/v1/object/")) {
        return { ok: storageOk, status: storageOk ? 200 : 500, json: async () => ({}) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    return calls;
  }

  const upload = (app, bytes = PNG, filename = "cover.png") =>
    request(app)
      .post(`/creator-studio/assets/${ASSET_ID}/file`)
      .set("Content-Type", "multipart/form-data; boundary=----t")
      .send(Buffer.concat([
        Buffer.from(`------t\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`, "latin1"),
        bytes,
        Buffer.from("\r\n------t--\r\n", "latin1")
      ]));

  describe("is only ever read with the workspace in the query", () => {
    it("filters the asset on organization_id, not just on id", async () => {
      const calls = recording();
      await request(buildApp()).get(`/creator-studio/assets/${ASSET_ID}/file`).expect(200);
      const read = calls.find((call) => call.href.includes("/rest/v1/creator_assets"));
      assert.ok(read, "the asset has to be read");
      assert.match(read.href, new RegExp(`id=eq\\.${ASSET_ID}`));
      assert.match(read.href, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`));
    });

    it("says the asset is not there when the filtered read returns nothing", async () => {
      recording({ rows: [] });
      const answer = await request(buildApp()).get(`/creator-studio/assets/${ASSET_ID}/file`).expect(404);
      assert.match(answer.text, /not on your list/);
    });

    it("does not tell somebody with no workspace that their asset is missing", async () => {
      recording();
      const app = buildApp({ organization: { ok: false, code: "customer_auth_required" } });
      const answer = await request(app).get(`/creator-studio/assets/${ASSET_ID}/file`).expect(200);
      assert.match(answer.text, /Set up your workspace/);
    });

    it("distinguishes a failed read from an asset with no file", async () => {
      // A read that did not happen is not a record with nothing in it, and
      // offering an upload form over an unknown state invites somebody to
      // overwrite something they cannot see.
      global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
      const answer = await request(buildApp()).get(`/creator-studio/assets/${ASSET_ID}/file`).expect(503);
      assert.match(answer.text, /cannot say whether a file is attached/);
      assert.doesNotMatch(answer.text, /Nothing attached/);
    });
  });

  describe("stores the bytes before it writes the row", () => {
    it("puts the file in the bucket first, then patches the asset", async () => {
      const calls = recording();
      await upload(buildApp()).expect(303);

      const putAt = calls.findIndex((c) => c.href.includes("/storage/v1/object/") && c.method === "POST");
      const patchAt = calls.findIndex((c) => c.method === "PATCH");
      assert.ok(putAt !== -1, "the bytes have to be stored");
      assert.ok(patchAt !== -1, "the row has to be updated");
      assert.ok(putAt < patchAt, "the other order leaves a download button that 404s for ever");
    });

    it("writes the stored path into the asset's metadata", async () => {
      const calls = recording();
      await upload(buildApp()).expect(303);
      const patch = calls.find((c) => c.method === "PATCH");
      const sent = JSON.parse(patch.body);
      assert.ok(sent.metadata.storage.path.startsWith(`${ORGANIZATION_ID}/`), sent.metadata.storage.path);
      assert.equal(sent.metadata.storage.type, "image/png");
      assert.equal(sent.metadata.storage.bytes, PNG.length);
    });

    it("does not patch the row when storage refused the file", async () => {
      const calls = recording({ storageOk: false });
      const answer = await upload(buildApp()).expect(502);
      assert.match(answer.text, /could not be stored/);
      assert.ok(!calls.some((c) => c.method === "PATCH"), "a failed upload must not leave a record pointing at nothing");
    });

    it("says so when the file stored and the row did not update", async () => {
      // The bytes are in the bucket and the row does not point at them.
      // Reporting that as a success leaves somebody looking for a file on a
      // page that will never show it.
      recording({ patchOk: false });
      const answer = await upload(buildApp()).expect(502);
      assert.match(answer.text, /stored but not attached/);
    });

    it("refuses a file whose bytes are not what its name claims", async () => {
      const calls = recording();
      const answer = await upload(buildApp(), Buffer.from("<html>not an image</html>"), "cover.png").expect(415);
      assert.match(answer.text, /not accepted/);
      assert.ok(!calls.some((c) => c.href.includes("/storage/v1/object/") && c.method === "POST"),
        "nothing that failed the check may reach the bucket");
    });
  });

  describe("hands the file back through a link that expires", () => {
    it("redirects to a signed URL rather than serving the bytes", async () => {
      recording({ rows: [assetRow({ storage: { path: `${ORGANIZATION_ID}/image/x-cover.png`, bytes: 10, type: "image/png", filename: "cover.png" } })] });
      const answer = await request(buildApp()).get(`/creator-studio/assets/${ASSET_ID}/file/open`).expect(302);
      assert.match(answer.headers.location, /\/object\/sign\/x\?token=t$/);
      assert.equal(answer.headers["cache-control"], "private, no-store");
    });

    it("has nothing to open when nothing is attached", async () => {
      recording({ rows: [assetRow()] });
      const answer = await request(buildApp()).get(`/creator-studio/assets/${ASSET_ID}/file/open`).expect(404);
      assert.match(answer.text, /no file on this asset/);
    });
  });

  describe("removes the object before it forgets about it", () => {
    it("deletes from storage and only then clears the metadata", async () => {
      const calls = recording({ rows: [assetRow({ storage: { path: `${ORGANIZATION_ID}/image/x.png`, bytes: 4, type: "image/png" } })] });
      await request(buildApp()).post(`/creator-studio/assets/${ASSET_ID}/file/remove`).expect(303);
      const deleteAt = calls.findIndex((c) => c.method === "DELETE");
      const patchAt = calls.findIndex((c) => c.method === "PATCH");
      assert.ok(deleteAt !== -1 && patchAt !== -1);
      assert.ok(deleteAt < patchAt, "a row saying 'no file' while the object is still there is worse than admitting the delete failed");
    });

    it("keeps the record pointing at the file when the delete failed", async () => {
      const calls = recording({ rows: [assetRow({ storage: { path: `${ORGANIZATION_ID}/image/x.png`, bytes: 4 } })], storageOk: false });
      const answer = await request(buildApp()).post(`/creator-studio/assets/${ASSET_ID}/file/remove`).expect(502);
      assert.match(answer.text, /could not be removed/);
      assert.ok(!calls.some((c) => c.method === "PATCH"));
    });
  });

  describe("says when uploads are not switched on", () => {
    it("shows setup-required rather than a form that cannot work", async () => {
      recording();
      // A project URL with no service-role key: configured enough to read, not
      // enough to store.
      const answer = await request(buildApp({ serviceRoleKey: "" })).get(`/creator-studio/assets/${ASSET_ID}/file`).expect(200);
      assert.match(answer.text, /not switched on/);
      assert.doesNotMatch(answer.text, /enctype="multipart\/form-data"/, "a form that cannot work is worse than a sentence saying so");
    });
  });
});
