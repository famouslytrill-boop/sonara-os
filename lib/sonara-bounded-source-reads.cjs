// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A bounded, ordered and settled read fanout for business control planes.
// Protects the data provider from per-request bursts without turning one
// unreadable source into a false zero or failing every independent source.
//
// This limits one fanout only. It is NOT a global service rate limiter,
// tenant quota, time-out, transaction fence or proof of provider availability.
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 8;

async function settledMapBounded(items, read, options = {}) {
  if (!Array.isArray(items)) throw new TypeError("read sources must be an array");
  if (typeof read !== "function") throw new TypeError("read must be a function");
  const concurrency = options?.concurrency === undefined
    ? DEFAULT_CONCURRENCY : options.concurrency;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new RangeError("concurrency must be an integer from 1 to 8");
  }

  // One result slot per input, in input order. No thrown read error can abort
  // remaining independent reads or leak provider error payloads into the UI.
  const results = new Array(items.length);
  let next = 0;
  const runner = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        const value = await read(items[index], index);
        results[index] = { ok: true, value };
      } catch {
        results[index] = { ok: false, code: "source_unavailable" };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return results;
}

module.exports = { DEFAULT_CONCURRENCY, MAX_CONCURRENCY, settledMapBounded };
