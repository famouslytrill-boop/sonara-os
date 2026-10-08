// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// Keeping something a person did while there was no signal, and sending it when
// there is.
//
// ## What is kept, and where
//
// The request body exactly as it would have been sent -- for a check-in,
// already reduced on the device to the precision the person chose, so the
// stored copy is no finer than what the server would have received. It is kept
// in this browser's localStorage under one key, at most MAX_ITEMS entries.
// On the next flush, entries older than the server accepts (a week) are dropped
// and counted, never sent as if fresh. A closed browser runs no cleanup.
//
// ## Each entry is sent once, however many times it is tried
//
// Every entry carries `client_event_id`, made here when it is first kept. The
// server records one row per id and answers a repeat as `duplicate`, so a send
// whose answer was lost can be retried without making a second record. That id
// is what makes retrying safe; without it this file would double-count.
//
// ## What counts as sent
//
// - The server answered and accepted it, or said it already had it: removed.
// - A permanent request refusal: removed and counted as refused.
// - Authentication, throttling, temporary failure or ambiguous evidence: kept.
// - No answer -- offline, a timeout, a 5xx: kept, and sending stops for now.
//   The next entries wait behind it so the order they happened in is kept.
//
// ## Nothing runs on its own except a retry of what the person already did
//
// It sends when the page loads and when the browser says it is back online,
// and only entries the person created by pressing a button.

(function (root) {
  "use strict";

  // v1 remains readable only as a legacy queue. New captures are partitioned
  // by the authenticated workspace and user, so one browser cannot replay an
  // old account's check-in under a new account.
  var STORAGE_KEY = "sonara.offline-queue.v1";
  var SCOPED_STORAGE_PREFIX = "sonara.offline-queue.v2";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var MAX_ITEMS = 50;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var activeFlushes = new WeakMap();

  function storageOf(options) {
    if (options && options.storage) return options.storage;
    try { return root.localStorage || null; } catch { return null; }
  }

  function scopeKey(scope) {
    var organizationId = scope && String(scope.organizationId || "").toLowerCase();
    var userId = scope && String(scope.userId || "").toLowerCase();
    if (!UUID.test(organizationId) || !UUID.test(userId)) return null;
    return SCOPED_STORAGE_PREFIX + "." + organizationId + "." + userId;
  }

  // Storage key fallback is intentionally NOT used for send/keep/pending.
  // The legacy key remains reviewable and explicitly discardable only.
  function keyFor(options) {
    return scopeKey(options && options.scope) || STORAGE_KEY;
  }

  function matchesCaptureScope(body, scope) {
    return Boolean(body && scope && scopeKey(scope) &&
      String(body.capture_user_id || "").toLowerCase() === String(scope.userId || "").toLowerCase() &&
      String(body.capture_organization_id || "").toLowerCase() === String(scope.organizationId || "").toLowerCase());
  }

  function read(storage, key) {
    if (!storage) return [];
    try {
      var parsed = JSON.parse(storage.getItem(key || STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(storage, items, key) {
    if (!storage) return false;
    try {
      storage.setItem(key || STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }

  function newId() {
    var cryptoApi = root.crypto || (typeof globalThis !== "undefined" ? globalThis.crypto : null);
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
    return null;
  }

  // Name an entry before its first attempt, so the first attempt and every
  // retry carry the same id. Returns the body to send now.
  function prepare(body, now) {
    var id = body.client_event_id || newId();
    if (!id) return null;
    var copy = {};
    for (var key in body) if (Object.prototype.hasOwnProperty.call(body, key)) copy[key] = body[key];
    copy.client_event_id = id;
    copy.captured_at = copy.captured_at || new Date(now || Date.now()).toISOString();
    return copy;
  }

  // Keep an entry the first attempt could not deliver. Refuses, rather than
  // silently dropping the oldest, when the queue is full or storage is
  // unavailable: the person is told it was not kept.
  function keep(endpoint, body, options) {
    if (!scopeKey(options && options.scope)) return { kept: false, reason: "scope_required" };
    if (endpoint !== "/api/location/events" || !body || !UUID.test(body.client_event_id || "")) {
      return { kept: false, reason: "invalid_entry" };
    }
    if (!matchesCaptureScope(body, options.scope)) return { kept: false, reason: "scope_mismatch" };
    var storage = storageOf(options);
    var key = keyFor(options);
    if (!storage) return { kept: false, reason: "no_storage" };
    var items = read(storage, key);
    if (items.some(function (item) { return item && item.body && item.body.client_event_id === body.client_event_id; })) {
      return { kept: true, pending: items.length };
    }
    if (items.length >= MAX_ITEMS) return { kept: false, reason: "full", pending: items.length };
    items.push({ endpoint: endpoint, body: body, retryAt: options && options.retryAt || 0, keptAt: new Date((options && options.now) || Date.now()).toISOString() });
    if (!write(storage, items, key)) return { kept: false, reason: "no_storage" };
    return { kept: true, pending: items.length, key };
  }

  function pending(options) {
    if (!scopeKey(options && options.scope)) return 0;
    return read(storageOf(options), keyFor(options)).length;
  }

  function summary(item, source, reason, index) {
    var body = item && item.body || {};
    var id = typeof body.client_event_id === "string" && UUID.test(body.client_event_id)
      ? body.client_event_id : source + ":" + index;
    // Legacy records can belong to another person who previously used this
    // browser. Do not disclose their capture time or event type merely because
    // the current signed-in user can review and discard stale local data.
    return Object.freeze({ id, source, reason, capturedAt: null, eventType: "check_in" });
  }

  // Legacy and scope-blocked records are inspectable but never silently moved
  // into a new account queue. The page can show this safe summary and ask the
  // person to discard a record explicitly.
  function review(options) {
    var storage = storageOf(options);
    if (!storage) return { entries: [], storageFailed: false };
    var scope = options && options.scope;
    var key = scopeKey(scope);
    var entries = [];
    if (key) {
      read(storage, key).forEach(function (item, index) {
        var body = item && item.body || {};
        var matches = String(body.capture_organization_id || "").toLowerCase() === String(scope.organizationId || "").toLowerCase()
          && String(body.capture_user_id || "").toLowerCase() === String(scope.userId || "").toLowerCase();
        if (!matches) entries.push(summary(item, "account", "scope_metadata_mismatch", index));
      });
    }
    read(storage, STORAGE_KEY).forEach(function (item, index) {
      entries.push(summary(item, "legacy", "legacy_entry_requires_review", index));
    });
    return { entries: entries, storageFailed: false };
  }

  function discard(id, options) {
    var identifier = String(id || "");
    var storage = storageOf(options);
    if (!storage) return { discarded: false, reason: "no_storage" };
    var source = options && options.source;
    var key = source === "legacy" ? STORAGE_KEY : scopeKey(options && options.scope);
    if (!key || !["legacy", "account"].includes(source)) return { discarded: false, reason: "scope_required" };
    var current = read(storage, key);
    var indexMatch = identifier.match(new RegExp("^" + source + ":([0-9]+)$"));
    var remaining;
    if (indexMatch) {
      var index = Number(indexMatch[1]);
      if (!Number.isSafeInteger(index) || !current[index]) return { discarded: false, reason: "not_found" };
      remaining = current.filter(function (_item, itemIndex) { return itemIndex !== index; });
    } else {
      if (!UUID.test(identifier)) return { discarded: false, reason: "invalid_entry" };
      remaining = current.filter(function (item) {
        return !item || !item.body || item.body.client_event_id !== identifier;
      });
    }
    if (remaining.length === current.length) return { discarded: false, reason: "not_found" };
    if (!write(storage, remaining, key)) return { discarded: false, reason: "no_storage" };
    return { discarded: true, source, pending: remaining.length };
  }

  // HTTP success alone is not a receipt: redirects can lead to login HTML,
  // and a 200 response may still contain { ok: false } after a database error.
  // This decision is shared by first delivery and replay.
  function deliveryResult(response, now) {
    now = now === undefined ? Date.now() : now;
    if (response.redirected || response.status === 401 || response.status === 403) {
      return Promise.resolve({ outcome: "auth" });
    }
    if (response.status >= 500 || [408, 425, 429].indexOf(response.status) !== -1) {
      var header = response.headers && response.headers.get("Retry-After");
      var delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : NaN;
      var retryAt = Number.isFinite(delay) ? now + delay : Date.parse(header || "");
      if (!Number.isFinite(retryAt) && response.status === 429) retryAt = now + 30000;
      return Promise.resolve({ outcome: "wait", retryAt: Number.isFinite(retryAt) ? retryAt : 0 });
    }
    if (!response.ok) return Promise.resolve({ outcome: "refused" });
    return Promise.resolve().then(function () { return response.json(); }).then(function (answer) {
      if (!answer || answer.ok !== true) return { outcome: "wait" };
      return { outcome: answer.duplicate === true ? "duplicate" : "sent" };
    }, function () { return { outcome: "wait" }; });
  }

  // A page-load retry and an online event share one run. Read current storage
  // when removing a receipt so an entry kept during the request is not erased.
  // This serializes one JavaScript context, not separate tabs.
  function flush(options) {
    var storage = storageOf(options);
    var key = keyFor(options);
    var send = (options && options.fetch) || root.fetch;
    var now = options && options.now !== undefined ? options.now : Date.now();
    var result = { sent: 0, duplicates: 0, refused: 0, expired: 0, waiting: 0, authenticationRequired: false, storageFailed: false, scopeRequired: false };
    // A missing/invalid scope previously fell back to the legacy v1 key and
    // could send someone else's location after account switching. That key is
    // now review/discard only; never run network requests with no valid identity.
    if (!scopeKey(options && options.scope)) {
      result.scopeRequired = true;
      return Promise.resolve(result);
    }
    if (!storage || typeof send !== "function") return Promise.resolve(result);
    var runs = activeFlushes.get(storage);
    if (!runs) { runs = new Map(); activeFlushes.set(storage, runs); }
    if (runs.has(key)) return runs.get(key);

    var items = read(storage, key);
    var fresh = items.filter(function (item) {
      var at = Date.parse(item && item.body && item.body.captured_at);
      var ok = Number.isFinite(at) && now - at < MAX_AGE_MS;
      if (!ok) result.expired += 1;
      return ok;
    });
    if (fresh.length !== items.length && !write(storage, fresh, key)) {
      result.storageFailed = true;
      result.waiting = items.length;
      return Promise.resolve(result);
    }

    function next(queue) {
      if (!queue.length) { result.waiting = read(storage, key).length; return Promise.resolve(result); }
      var item = queue[0];
      var scope = options && options.scope;
      // A partial or missing capture identity must fail closed too. The legacy
      // queue can be reviewed but must never be silently associated with today's
      // session. The server independently compares these fields with session.
      if (!item || !matchesCaptureScope(item.body, scope) ||
          (item.body.employee_id && item.body.employee_id !== scope.employeeId)) {
        result.authenticationRequired = true;
        result.waiting = read(storage, key).length;
        return Promise.resolve(result);
      }
      if (Number.isFinite(item.retryAt) && item.retryAt > now) {
        result.waiting = read(storage, key).length;
        return Promise.resolve(result);
      }
      var body = {};
      for (var field in item.body) if (Object.prototype.hasOwnProperty.call(item.body, field)) body[field] = item.body[field];
      body.sent_later = true;
      return Promise.resolve().then(function () {
        if (item.endpoint !== "/api/location/events" || !/^[0-9a-f-]{36}$/i.test(body.client_event_id || "")) {
          return { ok: false, status: 400 };
        }
        return send(item.endpoint, {
          method: "POST", redirect: "error",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin", body: JSON.stringify(body)
        });
      }).then(function (response) { return deliveryResult(response, now); }, function () { return { outcome: "wait" }; })
        .then(function (decision) {
          var current = read(storage, key);
          if (decision.outcome === "wait" || decision.outcome === "auth") {
            result.authenticationRequired = decision.outcome === "auth";
            if (decision.retryAt) {
              current.forEach(function (entry) {
                if (entry && entry.body && entry.body.client_event_id === item.body.client_event_id) entry.retryAt = decision.retryAt;
              });
              if (!write(storage, current, key)) result.storageFailed = true;
            }
            result.waiting = current.length;
            return result;
          }
          if (decision.outcome === "refused") result.refused += 1;
          else if (decision.outcome === "duplicate") result.duplicates += 1;
          else result.sent += 1;
          var remaining = current.filter(function (entry) {
            return !entry || !entry.body || entry.body.client_event_id !== item.body.client_event_id;
          });
          if (!write(storage, remaining, key)) {
            result.storageFailed = true;
            result.waiting = current.length;
            return result;
          }
          return next(queue.slice(1));
        });
    }
    var running = next(fresh).catch(function () {
      result.waiting = read(storage, key).length;
      return result;
    }).then(function (finished) { runs.delete(key); return finished; });
    runs.set(key, running);
    return running;
  }

  var api = { STORAGE_KEY: STORAGE_KEY, SCOPED_STORAGE_PREFIX: SCOPED_STORAGE_PREFIX, MAX_ITEMS: MAX_ITEMS, MAX_AGE_MS: MAX_AGE_MS, deliveryResult: deliveryResult, prepare: prepare, keep: keep, pending: pending, review: review, discard: discard, flush: flush };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraOfflineQueue = api;
})(typeof window !== "undefined" ? window : globalThis);
