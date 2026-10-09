// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const store = require("../lib/sonara-push-subscriptions.cjs");
const register = require("../routes/sonara-notification-routes.cjs");

const endpoint = "https://push.example.net/send/device-1";
const deps = {
  supabaseUrl: "https://project.supabase.co",
  serviceRoleHeaders: () => ({ Authorization: "Bearer fake-service-role" })
};

function response() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  return res;
}

function handlers({ organizationId = "org-A", userId = "user-A" } = {}) {
  const post = new Map();
  register({
    get: () => {},
    post: (path, ...middleware) => post.set(path, middleware[middleware.length - 1])
  }, {
    layout: () => "",
    brandCard: () => "",
    escapeHtml: (value) => value,
    requireCustomer: () => {},
    getCustomerPrimaryOrganization: async () => organizationId
      ? { ok: true, organizationId }
      : { ok: false },
    getSupabaseServerConfig: () => ({ url: deps.supabaseUrl }),
    supabaseHeaders: deps.serviceRoleHeaders,
    getEnv: () => null
  });
  return {
    route: post.get("/account/notifications/unsubscribe"),
    req: {
      sonaraUser: userId ? { id: userId } : null,
      body: { endpoint }
    }
  };
}

describe("browser push opt-out is scoped to its owner", () => {
  it("refuses unscoped deletes before any database request", async () => {
    const result = await store.remove(deps, { endpoint }, async () => {
      throw Error("unscoped deletion reached database");
    });
    assert.equal(result.code, "no_organization");
  });

  it("requires a known user when customer ownership is requested", async () => {
    const result = await store.remove(deps, {
      organizationId: "org-A", endpoint, createdBy: null
    }, async () => {
      throw Error("missing user deletion reached database");
    });
    assert.equal(result.code, "no_user");
  });

  it("filters by both organization and user for a customer opt-out", async () => {
    let requested;
    const result = await store.remove(deps, {
      organizationId: "org-A", endpoint, createdBy: "user-A"
    }, async (url, init) => {
      requested = { url: new URL(url), init };
      return { ok: true, status: 200, json: async () => [{ id: "deleted" }] };
    });
    assert.equal(result.ok, true);
    assert.equal(requested.init.method, "DELETE");
    assert.equal(requested.url.searchParams.get("organization_id"), "eq.org-A");
    assert.equal(requested.url.searchParams.get("endpoint"), "eq." + endpoint);
    assert.equal(requested.url.searchParams.get("created_by"), "eq.user-A");
  });

  it("allows dead-device cleanup only within the originating organization", async () => {
    let query;
    const result = await store.remove(deps, {
      organizationId: "org-A", endpoint
    }, async (url) => {
      query = new URL(url).searchParams;
      return { ok: true, status: 200, json: async () => [{ id: "deleted" }] };
    });
    assert.equal(result.ok, true);
    assert.equal(query.get("organization_id"), "eq.org-A");
    assert.equal(query.has("created_by"), false);
  });

  it("does not falsely confirm opt-out when zero rows were deleted", async () => {
    const result = await store.remove(deps, {
      organizationId: "org-A", endpoint, createdBy: "user-A"
    }, async () => ({ ok: true, status: 200, json: async () => [] }));
    assert.equal(result.ok, false);
    assert.equal(result.code, "not_found");
  });

  it("recognizes a confirmed delete only from returned rows", async () => {
    const result = await store.remove(deps, {
      organizationId: "org-A", endpoint, createdBy: "user-A"
    }, async () => ({ ok: true, status: 200, json: async () => [{ id: "deleted" }] }));
    assert.equal(result.ok, true);
    assert.equal(result.count, 1);
  });

  it("the authenticated route never relies on a client-supplied tenant", async () => {
    const saved = store.remove;
    let scope;
    store.remove = async (_deps, subject) => {
      scope = subject;
      return { ok: true };
    };
    try {
      const { route, req } = handlers();
      req.body.organizationId = "org-B"; // hostile body must not select the tenant
      const res = response();
      await route(req, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(scope, {
        organizationId: "org-A",
        endpoint,
        createdBy: "user-A"
      });
    } finally {
      store.remove = saved;
    }
  });

  it("rejects an account without a workspace without calling the store", async () => {
    const saved = store.remove;
    store.remove = async () => { throw Error("should not be called"); };
    try {
      const { route, req } = handlers({ organizationId: null });
      const res = response();
      await route(req, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, "no_organization");
    } finally {
      store.remove = saved;
    }
  });

  it("the page provides a real browser unsubscribe action without a permission prompt", () => {
    const client = fs.readFileSync(require.resolve("../public/sonara-push.js"), "utf8");
    const page = fs.readFileSync(require.resolve("../routes/sonara-notification-routes.cjs"), "utf8");
    assert.match(page, /data-sonara-push-unsubscribe/);
    assert.match(client, /getRegistration\("/);
    assert.match(client, /subscription\.unsubscribe\(\)/);
    assert.match(client, /config\.unsubscribeEndpoint/);
  });
});
