// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { createPgmqCanaryTransport } = require("../lib/sonara-pgmq-transport.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const CONFIG = Object.freeze({
  ok: true,
  url: "https://example.supabase.co",
  serviceRoleKey: "server-only-test-key"
});

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe("PGMQ canary transport", () => {
  it("binds every send to the configured tenant and pgmq_public schema", async () => {
    const calls = [];
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response(42);
      }
    });

    const result = await transport.send({ kind: "canary.sync", idempotencyKey: "abc" });
    assert.deepEqual(result, { ok: true, messageId: "42" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/send");
    assert.equal(calls[0].init.headers["Accept-Profile"], "pgmq_public");
    assert.equal(calls[0].init.headers["Content-Profile"], "pgmq_public");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      queue_name: "sonara_canary",
      message: {
        kind: "canary.sync",
        idempotencyKey: "abc",
        organizationId: ORG
      },
      sleep_seconds: 0
    });
  });

  it("refuses caller-supplied tenant scope", async () => {
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async () => response(1)
    });

    await assert.rejects(
      () => transport.send({ organizationId: OTHER_ORG, kind: "bad" }),
      /organization scope is assigned by the transport/
    );
  });

  it("returns only messages for the configured canary tenant", async () => {
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        assert.deepEqual(body, {
          queue_name: "sonara_canary",
          sleep_seconds: 45,
          n: 2
        });
        return response([
          {
            msg_id: 7,
            read_ct: 1,
            enqueued_at: "2026-09-24T20:00:00Z",
            vt: "2026-09-24T20:00:45Z",
            message: { organizationId: ORG, kind: "canary.sync" }
          }
        ]);
      }
    });

    const result = await transport.read({ visibilitySeconds: 45, limit: 2 });
    assert.equal(result.ok, true);
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].messageId, "7");
    assert.equal(result.messages[0].message.organizationId, ORG);
  });

  it("fails closed when a shared queue yields another tenant", async () => {
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async () => response([
        {
          msg_id: 9,
          read_ct: 1,
          message: { organizationId: OTHER_ORG, kind: "canary.sync" }
        }
      ])
    });

    const result = await transport.read();
    assert.equal(result.ok, false);
    assert.equal(result.code, "tenant_mismatch");
    assert.equal(result.refusedMessageId, "9");
    assert.deepEqual(result.messages, []);
  });

  it("archives and deletes only after the queue API confirms settlement", async () => {
    const calls = [];
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return response(true);
      }
    });

    assert.deepEqual(await transport.archive(12), { ok: true, messageId: "12" });
    assert.deepEqual(await transport.deleteMessage("13"), { ok: true, messageId: "13" });
    assert.deepEqual(calls, [
      {
        url: "https://example.supabase.co/rest/v1/rpc/archive",
        body: { queue_name: "sonara_canary", message_id: 12 }
      },
      {
        url: "https://example.supabase.co/rest/v1/rpc/delete",
        body: { queue_name: "sonara_canary", message_id: 13 }
      }
    ]);
  });

  it("never sends the service-role key to a non-Supabase origin", async () => {
    let called = false;
    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => ({
        ok: true,
        url: "https://collector.example.invalid",
        serviceRoleKey: "must-never-leave-the-process"
      }),
      fetchImpl: async () => {
        called = true;
        return response(true);
      }
    });

    assert.deepEqual(await transport.send({ kind: "canary.sync" }), {
      ok: false,
      code: "setup_required",
      status: null
    });
    assert.equal(called, false, "an untrusted origin received a fetch call that would carry the service-role key");
  });

  it("degrades safely when queue wrappers or credentials are unavailable", async () => {
    const missingConfig = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => ({ ok: false }),
      fetchImpl: async () => {
        throw new Error("should not be called");
      }
    });
    assert.deepEqual(await missingConfig.read(), {
      ok: false,
      code: "setup_required",
      status: null,
      messages: []
    });

    const networkFailure = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async () => {
        throw new Error("postgres://user:secret@example.invalid/db");
      }
    });
    assert.deepEqual(await networkFailure.send({ kind: "canary.sync" }), {
      ok: false,
      code: "send_failed",
      status: 0
    });
  });

  it("rejects unsafe queue names and unbounded read controls", async () => {
    assert.throws(
      () => createPgmqCanaryTransport({
        organizationId: ORG,
        queueName: "Bad Queue",
        getSupabaseServerConfig: () => CONFIG
      }),
      /queueName/
    );

    const transport = createPgmqCanaryTransport({
      organizationId: ORG,
      queueName: "sonara_canary",
      getSupabaseServerConfig: () => CONFIG,
      fetchImpl: async () => response([])
    });
    await assert.rejects(() => transport.read({ visibilitySeconds: 0 }), /visibilitySeconds/);
    await assert.rejects(() => transport.read({ limit: 11 }), /limit/);
    await assert.rejects(
      () => transport.archive("9007199254740993"),
      /positive safe integer/
    );

  });
});
