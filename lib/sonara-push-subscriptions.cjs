"use strict";

// Keeping and using the browsers that agreed to hear from us.
//
// `lib/sonara-web-push.cjs` can encrypt and send. This is what gives it
// somewhere to send to, and what deletes a row when the push service says the
// browser is gone. Without it that module is a capability nothing can reach --
// the defect this codebase keeps finding.
//
// ## Consent is per topic, not per switch
//
// AGENTS.md: *"Sounds, voice announcements, haptics, SMS, push, and email
// alerts must be off or explicitly user-controlled by default."* A single
// on/off makes "tell me when an invoice is paid" and "tell me about anything"
// the same permission, and only one of those is what most people meant. So a
// subscription carries the topics it agreed to, `notify()` filters on them, and
// **a subscription with no topics receives nothing** rather than everything.
//
// That default is the one worth stating: an empty list is the safe reading of
// "they granted permission and chose nothing", and the opposite reading is how
// a product ends up notifying somebody about things they never asked for.
//
// ## Deleting is part of sending
//
// A 404 or 410 from the push service means that browser is gone for ever. If
// the row survives, this application spends the rest of its life encrypting
// messages for a device that no longer exists -- work nobody sees and nothing
// reports. So `notify()` deletes on exactly those two statuses and on nothing
// else: a 429 or a 5xx is a bad minute, and deleting on those loses live
// subscribers to somebody else's outage.

const push = require("./sonara-web-push.cjs");

const REQUIRED = Object.freeze(["getEnv", "serviceRoleHeaders", "supabaseUrl"]);

const TABLE = "push_subscriptions";

// What a browser may ask to hear about. A closed list rather than free text:
// an unknown topic in the database is a subscription that matches nothing and
// looks like a bug in the sender.
const TOPICS = Object.freeze([
  "invoice_paid",
  "booking_made",
  "booking_reminder",
  "quote_accepted",
  "payment_failed",
  "job_finished"
]);

// Which of those topics anything in this application can actually send.
//
// The two lists exist separately because they answer different questions.
// TOPICS is what a subscription may *store*: narrowing it would silently
// invalidate a subscription somebody already made. This is what a page may
// honestly *offer*.
//
// They were the same list, and that was a promise the product did not keep. A
// person could open /account/notifications, tick "A job is marked finished",
// grant permission, and wait for ever -- and `job_finished` is the sharpest of
// the five, because **this application has no jobs**. There is no jobs table,
// no job record page, and no place a job could be marked finished. The topic
// named a feature that does not exist.
//
// tests/a-notification-topic-cannot-be-offered-with-nothing-to-send-it.test.js
// derives this list from the source -- every entry must appear as a `topic:`
// argument to a notify() call somewhere in lib/ or routes/ -- so it cannot
// drift into a second hand-maintained list that says whatever somebody hoped.
const SENDING_TOPICS = Object.freeze([
  "invoice_paid",
  "booking_made"
]);

/** Whether anything in this application sends this topic today. */
function isSending(topic) {
  return SENDING_TOPICS.includes(topic);
}

function knownTopics(requested) {
  if (!Array.isArray(requested)) return [];
  // Deduplicated and filtered rather than rejected wholesale: a browser sending
  // one topic this version does not know should still get the others, not lose
  // its whole subscription to a rename.
  return [...new Set(requested.filter((topic) => TOPICS.includes(topic)))];
}

/**
 * Store a subscription, or update the one this browser already had.
 *
 * The endpoint is unique, so a re-subscribe replaces rather than duplicating.
 * Without that a person who granted permission twice hears everything twice,
 * and nothing anywhere reports it.
 */
async function save(deps, { organizationId, endpoint, p256dh, auth, topics, label, createdBy }, fetchImpl = fetch) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  if (!endpoint || !/^https:\/\//.test(String(endpoint))) {
    return { ok: false, code: "bad_endpoint", detail: "A push endpoint must be an https URL." };
  }
  // Validated here as well as by the database constraint. The constraint is the
  // guarantee; this is the message a person can act on, because a failed check
  // constraint surfaces as a Postgres error nobody outside this file can read.
  if (!/^[A-Za-z0-9_-]{80,90}$/.test(String(p256dh || ""))) {
    return { ok: false, code: "bad_key", detail: "The subscription key is not a P-256 public key." };
  }
  if (!/^[A-Za-z0-9_-]{20,26}$/.test(String(auth || ""))) {
    return { ok: false, code: "bad_auth", detail: "The subscription auth secret is not 16 bytes." };
  }

  const row = {
    organization_id: organizationId,
    endpoint: String(endpoint),
    p256dh: String(p256dh),
    auth: String(auth),
    topics: knownTopics(topics),
    // Truncated rather than refused. This is a browser-supplied description for
    // a settings page; it is never parsed and never decides anything.
    label: label ? String(label).slice(0, 120) : null,
    created_by: createdBy || null,
    updated_at: new Date().toISOString()
  };

  let response;
  try {
    response = await fetchImpl(`${deps.supabaseUrl}/rest/v1/${TABLE}?on_conflict=endpoint`, {
      method: "POST",
      headers: {
        ...deps.serviceRoleHeaders(),
        "Content-Type": "application/json",
        // merge-duplicates is what makes a re-subscribe an update. Without it
        // the unique index turns the second grant into a 409 the browser sees
        // as a failure, and the person tries again.
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(row)
    });
  } catch {
    return { ok: false, code: "unwritable" };
  }
  if (!response?.ok) return { ok: false, code: "unwritable", status: response?.status ?? null };
  return { ok: true, topics: row.topics };
}

/**
 * The subscriptions for one organization that asked for this topic.
 *
 * Returns `{ ok, rows }`. `ok: false` means the read failed and says nothing
 * about how many subscribers there are -- which is a different thing from none,
 * and treating them alike is how "nobody is subscribed" gets reported to
 * somebody with fifty subscribers.
 */
async function forTopic(deps, organizationId, topic, fetchImpl = fetch) {
  if (!organizationId) return { ok: false, code: "no_organization", rows: [] };
  if (!TOPICS.includes(topic)) return { ok: false, code: "unknown_topic", rows: [] };
  const url =
    `${deps.supabaseUrl}/rest/v1/${TABLE}` +
    `?organization_id=eq.${encodeURIComponent(organizationId)}` +
    // Postgres array containment. A subscription with no topics matches nothing,
    // which is the safe reading of "granted permission and chose nothing".
    `&topics=cs.{${encodeURIComponent(topic)}}` +
    `&select=id,endpoint,p256dh,auth,label`;
  let response;
  try {
    response = await fetchImpl(url, { headers: deps.serviceRoleHeaders() });
  } catch {
    return { ok: false, code: "unreadable", rows: [] };
  }
  if (!response?.ok) return { ok: false, code: "unreadable", rows: [], status: response?.status ?? null };
  let rows;
  try {
    rows = await response.json();
  } catch {
    return { ok: false, code: "unreadable", rows: [] };
  }
  if (!Array.isArray(rows)) return { ok: false, code: "unreadable", rows: [] };
  return { ok: true, rows };
}

async function remove(deps, endpoint, fetchImpl = fetch) {
  if (!endpoint) return { ok: false, code: "no_endpoint" };
  let response;
  try {
    response = await fetchImpl(`${deps.supabaseUrl}/rest/v1/${TABLE}?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
      headers: deps.serviceRoleHeaders()
    });
  } catch {
    return { ok: false, code: "unwritable" };
  }
  if (!response?.ok) return { ok: false, code: "unwritable", status: response?.status ?? null };
  return { ok: true };
}

/**
 * Send one notification to everybody in an organization who asked for it.
 *
 * Returns counts rather than throwing on a partial failure: with several
 * subscribers, some succeeding and some not is the ordinary case, and an
 * exception would lose the ones that worked.
 *
 * **Deletes a subscription the push service says is gone, and only then.**
 */
async function notify(deps, { organizationId, topic, payload }, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const readiness = push.pushReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };

  const found = await forTopic(deps, organizationId, topic, fetchImpl);
  if (!found.ok) {
    // Not reported as "sent to nobody". A failed read says nothing about how
    // many subscribers exist.
    return { ok: false, code: found.code, detail: "Could not read who is subscribed, so nothing was sent." };
  }

  let sent = 0;
  let removed = 0;
  const failures = [];
  for (const row of found.rows) {
    const result = await push.send(deps, row, payload, { ...options, fetchImpl });
    if (result.ok) {
      sent += 1;
      continue;
    }
    if (result.code === "subscription_gone") {
      const deleted = await remove(deps, row.endpoint, fetchImpl);
      if (deleted.ok) removed += 1;
      // Counted as removed rather than failed: the push service told us
      // definitively, and there is nothing wrong to report.
      continue;
    }
    failures.push({ endpoint: row.endpoint, code: result.code });
  }

  return {
    ok: true,
    // Reported separately on purpose. "Sent to 3, 2 browsers gone, 1 could not
    // be reached" is four different facts, and a single success boolean loses
    // all of them.
    considered: found.rows.length,
    sent,
    removed,
    failures
  };
}

module.exports = { REQUIRED, TABLE, TOPICS, SENDING_TOPICS, isSending, knownTopics, save, forTopic, remove, notify };
