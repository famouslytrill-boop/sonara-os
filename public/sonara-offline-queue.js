// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
//
// Field check-ins may contain a person's location. A browser can retain
// localStorage after logout and can be used by more than one customer.
// Each queued operation is therefore bound to the authenticated organization
// AND user who created it. A missing/legacy binding is NEVER replayed.
// Server-side replay also verifies both identities; browser scope is not auth.
//
// An accepted/duplicate result removes exactly its original queued entry,
// not a stale snapshot of the whole queue. A new check-in saved while an
// earlier request was in flight must not be lost when that response arrives.

(function (root) {
  "use strict";

  var STORAGE_KEY = "sonara.offline-queue.v1";
  var MAX_ITEMS = 50;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var ENDPOINT = "/api/location/events";
  var SCOPE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  function scopeOf(options) {
    var scope = options && options.scope;
    return typeof scope === "string" && SCOPE.test(scope) ? scope.toLowerCase() : null;
  }

  function storageOf(options) {
    if (options && options.storage) return options.storage;
    try { return root.localStorage || null; } catch { return null; }
  }

  function read(storage) {
    if (!storage) return [];
    try {
      var parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(storage, items) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items));
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

  function prepare(body, now) {
    var id = body.client_event_id || newId();
    if (!id) return null;
    var copy = {};
    for (var key in body) if (Object.prototype.hasOwnProperty.call(body, key)) copy[key] = body[key];
    copy.client_event_id = id;
    copy.captured_at = copy.captured_at || new Date(now || Date.now()).toISOString();
    return copy;
  }

  function keep(endpoint, body, options) {
    var scope = scopeOf(options);
    if (!scope) return { kept: false, reason: "scope_required" };
    if (endpoint !== ENDPOINT) return { kept: false, reason: "endpoint_not_allowed" };
    if (!body || typeof body !== "object" || !body.client_event_id ||
      !body.captured_at || !SCOPE.test(String(body.origin_organization_id || "") + ":" + String(body.origin_user_id || "")) ||
      scope !== (String(body.origin_organization_id) + ":" + String(body.origin_user_id)).toLowerCase()) {
      return { kept: false, reason: "identity_mismatch" };
    }
    var storage = storageOf(options);
    if (!storage) return { kept: false, reason: "no_storage" };
    var items = read(storage);
    if (items.some(function (item) {
      return item.scope === scope && item.body && item.body.client_event_id === body.client_event_id;
    })) return { kept: true, pending: items.filter(function (item) { return item.scope === scope; }).length };
    if (items.length >= MAX_ITEMS) return { kept: false, reason: "full", pending: items.length };
    items.push({ scope: scope, endpoint: endpoint, body: body, keptAt: new Date((options && options.now) || Date.now()).toISOString() });
    if (!write(storage, items)) return { kept: false, reason: "no_storage" };
    return { kept: true, pending: items.filter(function (item) { return item.scope === scope; }).length };
  }

  function pending(options) {
    var scope = scopeOf(options);
    if (!scope) return 0;
    return read(storageOf(options)).filter(function (item) { return item && item.scope === scope; }).length;
  }

  function counts(items, scope) {
    return {
      legacy: items.filter(function (item) { return item && !item.scope; }).length,
      otherAccount: items.filter(function (item) { return item && item.scope && item.scope !== scope; }).length
    };
  }

  function flush(options) {
    var storage = storageOf(options);
    var send = (options && options.fetch) || root.fetch;
    var scope = scopeOf(options);
    var now = (options && options.now) || Date.now();
    var result = { sent: 0, duplicates: 0, refused: 0, expired: 0, waiting: 0,
      legacy: 0, otherAccount: 0, authRequired: false, scopeRequired: !scope };
    if (!storage) return Promise.resolve(result);

    var items = read(storage);
    if (!scope) {
      result.waiting = items.length;
      result.legacy = items.filter(function (item) { return !item || !item.scope; }).length;
      return Promise.resolve(result);
    }

    var fresh = items.filter(function (item) {
      var at = Date.parse(item && item.body && item.body.captured_at);
      var valid = item && Number.isFinite(at) && at <= now + 5 * 60 * 1000 && now - at < MAX_AGE_MS;
      if (!valid) result.expired += 1;
      return valid;
    });
    if (fresh.length !== items.length && !write(storage, fresh)) {
      result.waiting = items.length;
      return Promise.resolve(result);
    }
    var skipped = counts(fresh, scope);
    result.legacy = skipped.legacy;
    result.otherAccount = skipped.otherAccount;
    var ours = fresh.filter(function (item) { return item.scope === scope; });
    if (typeof send !== "function") {
      result.waiting = ours.length;
      return Promise.resolve(result);
    }

    function removeDelivered(item) {
      // Preserve additions from another browser tab or a new submit made while
      // this request was awaiting its response.
      var live = read(storage);
      return write(storage, live.filter(function (candidate) {
        return !(candidate && candidate.scope === item.scope &&
          candidate.endpoint === item.endpoint &&
          candidate.body && candidate.body.client_event_id === item.body.client_event_id);
      }));
    }

    function next(queue) {
      if (!queue.length) return Promise.resolve(result);
      var item = queue[0];
      // Untrusted localStorage can be edited by extensions and scripts. Never
      // send a different endpoint, a forged identity or an unbound old entry.
      var payload = item && item.body;
      if (!item || item.endpoint !== ENDPOINT || !payload ||
        String(payload.origin_organization_id || "").toLowerCase() + ":" +
        String(payload.origin_user_id || "").toLowerCase() !== scope) {
        result.waiting = queue.length;
        return Promise.resolve(result);
      }
      var body = {};
      for (var key in payload) if (Object.prototype.hasOwnProperty.call(payload, key)) body[key] = payload[key];
      body.sent_later = true;
      return Promise.resolve()
        .then(function () {
          return send(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body)
          });
        })
        .then(function (response) {
          if (!response || [401, 403].includes(response.status)) return "auth";
          if (response.status === 408 || response.status === 429 || response.status >= 500) return "wait";
          if (!response.ok) return "refused";
          return response.json().then(function (answer) {
            if (!answer || answer.ok !== true) return "wait";
            return answer.duplicate ? "duplicate" : "sent";
          }, function () { return "wait"; });
        }, function () { return "wait"; })
        .then(function (outcome) {
          if (outcome === "wait" || outcome === "auth") {
            result.waiting = queue.length;
            if (outcome === "auth") result.authRequired = true;
            return result;
          }
          if (!removeDelivered(item)) {
            result.waiting = queue.length;
            return result;
          }
          if (outcome === "refused") result.refused += 1;
          else if (outcome === "duplicate") result.duplicates += 1;
          else result.sent += 1;
          return next(queue.slice(1));
        });
    }
    return next(ours);
  }

  var api = { STORAGE_KEY: STORAGE_KEY, MAX_ITEMS: MAX_ITEMS, MAX_AGE_MS: MAX_AGE_MS,
    prepare: prepare, keep: keep, pending: pending, flush: flush };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraOfflineQueue = api;
})(typeof window !== "undefined" ? window : globalThis);
