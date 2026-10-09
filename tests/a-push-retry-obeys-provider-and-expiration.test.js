// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const retry = require("../lib/sonara-delivery-retry-policy.cjs");
const push = require("../lib/sonara-web-push.cjs");

const NOW = Date.parse("2026-10-09T12:00:00.000Z");

describe("deterministic push retry decisions", () => {
  it("reads a provider delay in whole seconds", () => {
    assert.deepEqual(retry.readRetryAfter("120", { nowMs: NOW }), { status: "ok", seconds: 120 });
    assert.deepEqual(retry.readRetryAfter("0", { nowMs: NOW }), { status: "ok", seconds: 0 });
  });

  it("supports RFC 9110 HTTP dates without depending on the machine clock", () => {
    assert.deepEqual(retry.readRetryAfter("Fri, 09 Oct 2026 12:02:00 GMT", { nowMs: NOW }), { status: "ok", seconds: 120 });
    assert.deepEqual(retry.readRetryAfter("Fri, 09 Oct 2026 11:59:00 GMT", { nowMs: NOW }), { status: "ok", seconds: 0 });
  });

  it("rejects invalid or overlarge instructions, never abbreviating a month-long provider hold", () => {
    for (const value of ["-10", "0.1", "not a date", "Wed, 32 Foo 2026 12:00:00 GMT"]) {
      assert.equal(retry.readRetryAfter(value, { nowMs: NOW }).status, "malformed");
    }
    assert.equal(retry.readRetryAfter("999999999", { nowMs: NOW }).status, "too_far");
    assert.equal(retry.nextRetry({ attempt: 1, nowMs: NOW, retryAfter: "999999999" }).status, "operator_review");
  });

  it("uses bounded exponential backoff and deterministic jitter", () => {
    const low = retry.nextRetry({ attempt: 2, nowMs: NOW, jitter: 0 });
    const high = retry.nextRetry({ attempt: 2, nowMs: NOW, jitter: 1 });
    assert.equal(low.delaySeconds, 5);
    assert.equal(high.delaySeconds, 10);
    assert.equal(high.dueAt, "2026-10-09T12:00:10.000Z");
  });

  it("waits at least the provider's delay even when local backoff is shorter", () => {
    const plan = retry.nextRetry({ attempt: 1, nowMs: NOW, jitter: 0, retryAfter: "120" });
    assert.equal(plan.delaySeconds, 120);
    assert.equal(plan.reason, "provider_retry_after");
  });

  it("does not retry a notification at or beyond its useful expiration", () => {
    assert.equal(retry.nextRetry({ attempt: 1, nowMs: NOW, expiresAtMs: NOW }).status, "expired");
    assert.equal(retry.nextRetry({ attempt: 1, nowMs: NOW, expiresAtMs: NOW + 1000 }).reason, "would_outlive_message");
  });

  it("stops at its finite attempt cap, with no automatic infinite loop", () => {
    assert.equal(retry.nextRetry({ attempt: retry.MAX_ATTEMPTS, nowMs: NOW }).status, "dead_letter");
    assert.equal(retry.nextRetry({ attempt: 0, nowMs: NOW }).status, "invalid");
    assert.equal(retry.nextRetry({ attempt: 1, nowMs: NOW, jitter: Infinity }).status, "invalid");
  });

  it("passes the provider delay through the actual Web Push send result", async () => {
    const keys = push.generateVapidKeys();
    const deps = {
      getEnv: (name) => ({
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: "mailto:test@example.com"
      })[name]
    };
    const subscription = {
      endpoint: "https://push.example.net/one",
      p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg"
    };
    const result = await push.send(deps, subscription, "test", {
      now: NOW,
      fetchImpl: async () => ({
        ok: false, status: 429,
        headers: { get: (name) => name === "retry-after" ? "120" : null }
      })
    });
    assert.equal(result.code, "retry_later");
    assert.equal(result.retryAfterSeconds, 120);
    assert.equal(result.retryAfterStatus, "ok");

    const gone = await push.send(deps, subscription, "test", {
      now: NOW, fetchImpl: async () => ({ ok: false, status: 410 })
    });
    assert.equal(gone.code, "subscription_gone");
    assert.equal(gone.retryAfterSeconds, undefined);
  });
});
