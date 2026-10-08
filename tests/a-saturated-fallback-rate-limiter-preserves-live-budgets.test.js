// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  consumeRateLimit,
  __resetInMemoryBucketsForTests
} = require("../lib/sonara-rate-limit.cjs");

const offline = () => ({ ok: false });
const consume = (key, seconds = 3600) => consumeRateLimit(key, {
  windowSeconds: seconds,
  maxAttempts: 1,
  getSupabaseServerConfig: offline
});

describe("an in-memory limiter at capacity cannot erase live abuse budgets", function () {
  this.timeout(15000);

  afterEach(() => __resetInMemoryBucketsForTests());

  it("denies new identities at capacity and still denies a previously limited identity", async () => {
    __resetInMemoryBucketsForTests();
    for (let i = 0; i < 10000; i += 1) {
      const result = await consume(`rate-cap-${i}`);
      assert.equal(result.allowed, true, `initial request for bucket ${i}`);
    }
    const overflow = await consume("rate-cap-overflow");
    assert.equal(overflow.allowed, false);
    assert.equal(overflow.saturated, true);
    assert.equal(overflow.durable, false);
    assert.ok(overflow.retryAfterSeconds > 0);

    // The former implementation cleared all 10,000 live counters here,
    // letting this account evade the rate limit by filling the map.
    const repeat = await consume("rate-cap-0");
    assert.equal(repeat.allowed, false);
    assert.equal(repeat.remaining, 0);

    const nextOverflow = await consume("rate-cap-overflow-next");
    assert.equal(nextOverflow.allowed, false);
    assert.equal(nextOverflow.saturated, true);
  });

  it("expires short-lived buckets without clearing another limiter's longer window", async () => {
    __resetInMemoryBucketsForTests();
    const realNow = Date.now;
    let clock = 2000000000000;
    Date.now = () => clock;
    try {
      assert.equal((await consume("long-running", 3600)).allowed, true);
      for (let i = 0; i < 9999; i += 1) {
        assert.equal((await consume(`short-${i}`, 1)).allowed, true);
      }
      clock += 1500;
      const replacement = await consume("replacement", 1);
      assert.equal(replacement.allowed, true);
      // Expiration is per bucket; a short incoming request cannot discard
      // the 3600-second limit retained for another identity.
      const repeatLong = await consume("long-running", 3600);
      assert.equal(repeatLong.allowed, false);
    } finally {
      Date.now = realNow;
    }
  });

  it("can receive new identities after explicit test reset", async () => {
    __resetInMemoryBucketsForTests();
    const first = await consume("first");
    assert.equal(first.allowed, true);
    __resetInMemoryBucketsForTests();
    const second = await consume("first");
    assert.equal(second.allowed, true);
  });
});
