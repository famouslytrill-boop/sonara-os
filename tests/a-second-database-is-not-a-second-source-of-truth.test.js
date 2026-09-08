"use strict";

const assert = require("node:assert/strict");
const d1 = require("../lib/sonara-d1-adapter.cjs");
const workersAi = require("../lib/sonara-workers-ai-adapter.cjs");
const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

// The whole reason a second database is dangerous here: the tenant boundary is
// organization_id filtering against Supabase, because the service-role key
// bypasses row-level security. A customer row in D1 is a customer row outside
// the only boundary this product has.
//
// So the adapter refuses any statement naming a table the migrations create,
// and these are the tests that say it does. The first one exists because every
// claim below is satisfied by an empty reserved-name set.

function readiness(overrides = {}) {
  const value = {
    enabled: true,
    status: "configured",
    timeoutMs: 20,
    host: "api.cloudflare.com",
    account: "0123456789abcdef0123456789abcdef",
    database: "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    ...overrides
  };
  Object.defineProperty(value, "baseUrl", { value: "https://api.cloudflare.com/client/v4", enumerable: false });
  return value;
}

describe("a second database is not a second source of truth", () => {
  it("has reserved names to check, so none of this passes on an empty set", () => {
    assert.ok(
      d1.RESERVED_TABLE_NAMES.size >= 300,
      `only ${d1.RESERVED_TABLE_NAMES.size} reserved table names; this check has gone blind`
    );
    assert.ok(TENANT_SCOPED_TABLES.has("invoices") || TENANT_SCOPED_TABLES.size >= 200, "the tenant-scoped list is not the one this guards");
  });

  it("refuses a statement naming a table Supabase owns", () => {
    // Taken from the generated list rather than typed, so this cannot drift
    // into naming a table that no longer exists and passing for that reason.
    const [scoped] = [...TENANT_SCOPED_TABLES];
    const reason = d1.derivedOnlyViolation(`select * from ${scoped} where id = ?`);
    assert.match(reason, new RegExp(scoped), "the refusal must name the table it refused");
    assert.match(reason, /Supabase owns/);
  });

  it("allows a derived table that is nobody's system of record", () => {
    assert.equal(d1.derivedOnlyViolation("select hits from edge_rate_counters where key = ?"), "");
    assert.equal(d1.derivedOnlyViolation("insert into cached_totals (key, total) values (?, ?)"), "");
  });

  it("refuses a second statement riding behind an allowed one", () => {
    const [scoped] = [...TENANT_SCOPED_TABLES];
    assert.match(d1.derivedOnlyViolation(`select 1; drop table ${scoped}`), /one statement/i);
    // A single trailing semicolon is ordinary, not a batch.
    assert.equal(d1.derivedOnlyViolation("select hits from edge_rate_counters;"), "");
  });

  it("refuses comments, which are how a reserved name gets past a scan", () => {
    assert.match(d1.derivedOnlyViolation("select 1 -- from invoices"), /comments/i);
    assert.match(d1.derivedOnlyViolation("select /* invoices */ 1"), /comments/i);
  });

  it("does not reach the network for a refused statement", async () => {
    let called = false;
    const [scoped] = [...TENANT_SCOPED_TABLES];
    const result = await d1.query(`select * from ${scoped}`, [], { readiness: readiness(), fetchImpl: async () => { called = true; } });
    assert.equal(called, false, "a refused statement must not be sent");
    assert.equal(result.code, "refused");
  });

  it("requires an array of params, so a forgotten argument is not an empty one", async () => {
    const result = await d1.query("select 1", undefined, { readiness: readiness(), fetchImpl: async () => { throw new Error("must not be called"); } });
    assert.equal(result.code, "invalid_params");
  });

  it("refuses an account or database id that would address a different endpoint", async () => {
    for (const bad of ["../../accounts", "not-a-uuid", ""]) {
      const result = await d1.query("select 1", [], { readiness: readiness({ database: bad }), fetchImpl: async () => { throw new Error("must not be called"); } });
      assert.equal(result.code, "setup_required", `${bad} was accepted as a database id`);
    }
  });

  it("separates a failed statement from an empty result set", async () => {
    const failed = await d1.query("select 1", [], {
      readiness: readiness(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: false, errors: [{ message: "no such table" }] }) })
    });
    assert.equal(failed.code, "query_failed");
    assert.match(failed.detail, /no such table/);

    const empty = await d1.query("select 1", [], {
      readiness: readiness(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, result: [{ results: [] }] }) })
    });
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.rows, [], "no rows is a successful answer, not a failure");

    // An answer with no result set at all is not zero rows. Reading it as zero
    // is how a failed read becomes "you have no records".
    const absent = await d1.query("select 1", [], {
      readiness: readiness(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
    });
    assert.equal(absent.ok, false);
    assert.equal(absent.code, "unreadable_response");
  });
});

describe("Workers AI addresses the model it was configured with", () => {
  function aiReadiness(overrides = {}) {
    const value = {
      enabled: true,
      status: "configured",
      timeoutMs: 20,
      host: "api.cloudflare.com",
      account: "0123456789abcdef0123456789abcdef",
      model: "@cf/meta/llama-3.1-8b-instruct",
      ...overrides
    };
    Object.defineProperty(value, "baseUrl", { value: "https://api.cloudflare.com/client/v4", enumerable: false });
    return value;
  }

  it("accepts the model id forms Cloudflare actually publishes", () => {
    for (const model of ["@cf/meta/llama-3.1-8b-instruct", "@cf/baai/bge-base-en-v1.5", "@hf/thebloke/llama-2-13b-chat-awq"]) {
      assert.ok(workersAi.MODEL_PATTERN.test(model), `${model} should be a valid model id`);
    }
  });

  it("refuses a model id that would address a different endpoint", async () => {
    for (const model of ["../../user/tokens", "@cf/../../admin", "@cf/meta/llama 3", "llama3", "@cf/meta/llama?x=1"]) {
      assert.equal(workersAi.MODEL_PATTERN.test(model), false, `${model} should not be a valid model id`);
      const result = await workersAi.generate([{ role: "user", content: "hi" }], {
        readiness: aiReadiness({ model }),
        fetchImpl: async () => { throw new Error("must not be called"); }
      });
      assert.equal(result.code, "setup_required", `${model} reached the network`);
    }
  });

  it("reads the refusal Cloudflare reports inside a 200", async () => {
    const result = await workersAi.generate([{ role: "user", content: "hi" }], {
      readiness: aiReadiness(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: false, errors: [{ message: "Model not found" }] }) })
    });
    assert.equal(result.code, "provider_refused");
    assert.match(result.detail, /Model not found/);
  });

  it("returns the text of a run that succeeded", async () => {
    const result = await workersAi.generate([{ role: "user", content: "hi" }], {
      readiness: aiReadiness(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, result: { response: "hello" } }) })
    });
    assert.deepEqual(result, { ok: true, text: "hello" });
  });

  it("refuses messages that are not a chat array", async () => {
    for (const messages of [[], "hi", [{ role: "user" }], [{ content: "hi" }]]) {
      const result = await workersAi.generate(messages, {
        readiness: aiReadiness(),
        fetchImpl: async () => { throw new Error("must not be called"); }
      });
      assert.equal(result.code, "invalid_messages");
    }
  });
});
