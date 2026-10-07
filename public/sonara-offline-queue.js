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
// Nothing is kept for longer than the server will accept it (a week); an entry
// older than that is dropped and counted, never sent as if it were fresh.
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
// - The server answered and refused it (a 4xx): removed and counted as
//   refused, because sending the same thing again will be refused again.
// - No answer -- offline, a timeout, a 5xx: kept, and sending stops for now.
//   The next entries wait behind it so the order they happened in is kept.
//
// ## Nothing runs on its own except a retry of what the person already did
//
// It sends when the page loads and when the browser says it is back online,
// and only entries the person created by pressing a button.

(function (root) {
  "use strict";

  var STORAGE_KEY = "sonara.offline-queue.v1";
  var MAX_ITEMS = 50;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function storageOf(options) {
    if (options && options.storage) return options.storage;
    try { return root.localStorage || null; } catch (error) { return null; }
  }

  function read(storage) {
    if (!storage) return [];
    try {
      var parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function write(storage, items) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (error) {
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
    var storage = storageOf(options);
    if (!storage) return { kept: false, reason: "no_storage" };
    var items = read(storage);
    if (items.some(function (item) { return item.body && item.body.client_event_id === body.client_event_id; })) {
      return { kept: true, pending: items.length };
    }
    if (items.length >= MAX_ITEMS) return { kept: false, reason: "full", pending: items.length };
    items.push({ endpoint: endpoint, body: body, keptAt: new Date((options && options.now) || Date.now()).toISOString() });
    if (!write(storage, items)) return { kept: false, reason: "no_storage" };
    return { kept: true, pending: items.length };
  }

  function pending(options) {
    return read(storageOf(options)).length;
  }

  // Send what is kept, oldest first. Resolves with what happened; never rejects.
  function flush(options) {
    var storage = storageOf(options);
    var send = (options && options.fetch) || root.fetch;
    var now = (options && options.now) || Date.now();
    var result = { sent: 0, duplicates: 0, refused: 0, expired: 0, waiting: 0 };
    if (!storage || typeof send !== "function") return Promise.resolve(result);

    var items = read(storage);
    var fresh = items.filter(function (item) {
      var at = Date.parse(item.body && item.body.captured_at);
      var ok = Number.isFinite(at) && now - at < MAX_AGE_MS;
      if (!ok) result.expired += 1;
      return ok;
    });
    if (fresh.length !== items.length) write(storage, fresh);

    function next(queue) {
      if (!queue.length) { write(storage, []); return Promise.resolve(result); }
      var item = queue[0];
      var body = {};
      for (var key in item.body) if (Object.prototype.hasOwnProperty.call(item.body, key)) body[key] = item.body[key];
      body.sent_later = true;
      return Promise.resolve()
        .then(function () {
          return send(item.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body)
          });
        })
        .then(function (response) {
          if (response.status >= 500) return "wait";
          if (!response.ok) return "refused";
          return response.json().then(function (answer) {
            return answer && answer.duplicate ? "duplicate" : "sent";
          }, function () { return "sent"; });
        }, function () { return "wait"; })
        .then(function (outcome) {
          if (outcome === "wait") {
            result.waiting = queue.length;
            write(storage, queue);
            return result;
          }
          if (outcome === "refused") result.refused += 1;
          else if (outcome === "duplicate") result.duplicates += 1;
          else result.sent += 1;
          var rest = queue.slice(1);
          write(storage, rest);
          return next(rest);
        });
    }
    return next(fresh);
  }

  var api = { STORAGE_KEY: STORAGE_KEY, MAX_ITEMS: MAX_ITEMS, MAX_AGE_MS: MAX_AGE_MS, prepare: prepare, keep: keep, pending: pending, flush: flush };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraOfflineQueue = api;
})(typeof window !== "undefined" ? window : globalThis);
