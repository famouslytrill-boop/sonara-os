// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What the email provider reported about a campaign message after accepting it.
//
// Resend signs its webhooks with Svix. The scheme, from
// docs.svix.com/receiving/verifying-payloads/how-manual, read 7 October 2026:
//
//   signed content   `${svix-id}.${svix-timestamp}.${raw body}`
//   algorithm        HMAC-SHA256, output base64
//   key              the signing secret after its `whsec_` prefix, base64-decoded
//   header           `svix-signature`: space-separated `v1,<base64>` entries
//
// That page publishes a test vector -- secret whsec_plJ3nmyCDGBKInavdOK15jsl,
// id msg_loFOjxBNrRLzqYUf, timestamp 1731705121, a ping payload, signature
// v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0= -- and
// tests/a-campaign-email-says-what-happened-to-it.test.js reproduces it, so this
// is checked against the vendor's own value rather than against a reading of
// it. The tolerance is not specified there; five minutes, which is what the
// Svix libraries use.
//
// Event names and the bounce object are from resend.com/docs/dashboard/
// webhooks/event-types and resend.com/docs/webhooks/emails/bounced, read the
// same day. `email_id` is the id the send endpoint returned, which
// growth_campaign_sends keeps as provider_message_id.

const crypto = require("node:crypto");

const TOLERANCE_SECONDS = 5 * 60;

// Provider event name -> what is recorded. email.sent, email.scheduled and
// email.received say nothing about a message after it was accepted, so they are
// acknowledged and not recorded.
const EVENT_TYPES = Object.freeze({
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed",
  "email.suppressed": "suppressed"
});

const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Whether a webhook request is genuinely from the provider.
 * `{ ok: true }` or `{ ok: false, code }`; never throws.
 */
function verifySignature({ secret, id, timestamp, signature, body, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const match = /^whsec_([A-Za-z0-9+/=]+)$/.exec(String(secret || ""));
  if (!match) return { ok: false, code: "not_configured" };
  const key = Buffer.from(match[1], "base64");
  if (!key.length) return { ok: false, code: "not_configured" };
  if (!EVENT_ID.test(String(id || ""))) return { ok: false, code: "unsigned" };
  const seconds = Number(timestamp);
  if (!/^\d{1,12}$/.test(String(timestamp || "")) || !Number.isSafeInteger(seconds)) return { ok: false, code: "unsigned" };
  if (Math.abs(nowSeconds - seconds) > TOLERANCE_SECONDS) return { ok: false, code: "stale" };
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ""), "utf8");
  const expected = crypto.createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`, "utf8"), raw]))
    .digest();
  const offered = String(signature || "").split(" ").filter(Boolean);
  for (const entry of offered) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, code: "bad_signature" };
}

/**
 * The row a verified event becomes, or why it becomes none.
 * `{ record: { event_type, provider_message_id, bounce_type, occurred_at } }`
 * or `{ ignore: code }`.
 */
function receiptFrom(event) {
  const eventType = EVENT_TYPES[String(event?.type || "")];
  if (!eventType) return { ignore: "not_a_receipt" };
  const data = event?.data || {};
  const messageId = String(data.email_id || "");
  if (!MESSAGE_ID.test(messageId)) return { ignore: "no_message_id" };
  const occurred = new Date(event.created_at || data.created_at || "");
  if (Number.isNaN(occurred.getTime())) return { ignore: "no_time" };
  let bounceType = null;
  if (eventType === "bounced") {
    const kind = String(data.bounce?.type || "").toLowerCase();
    bounceType = kind === "permanent" || kind === "transient" ? kind : "undetermined";
  }
  return {
    record: {
      event_type: eventType,
      provider_message_id: messageId.toLowerCase(),
      bounce_type: bounceType,
      occurred_at: occurred.toISOString()
    }
  };
}

const DELIVERY_STATES = Object.freeze(["delivered", "delivery_delayed", "bounced", "complained", "opened", "clicked", "failed", "suppressed"]);

/**
 * What a campaign's receipts add up to, counted per message rather than per
 * event: three opens of one email are one opened email.
 *
 * `trackable` is how many accepted sends carry a provider message id. Only those
 * can ever have a receipt -- an accepted message sent through the provider's
 * single-message endpoint returns no id this application reads -- so
 * "40 delivered" means 40 of `trackable`, not of everything accepted.
 */
function summarizeDelivery({ sends, events } = {}) {
  if (!sends?.ok || !events?.ok) return null;
  const trackable = new Set(sends.rows
    .filter((row) => row?.status === "accepted" && row.provider_message_id)
    .map((row) => String(row.provider_message_id).toLowerCase()));
  const byState = Object.fromEntries(DELIVERY_STATES.map((state) => [state, new Set()]));
  let permanentBounces = 0;
  const permanent = new Set();
  for (const row of events.rows) {
    if (!DELIVERY_STATES.includes(row?.event_type)) continue;
    const message = String(row.provider_message_id || "").toLowerCase();
    byState[row.event_type].add(message);
    if (row.event_type === "bounced" && row.bounce_type === "permanent" && !permanent.has(message)) {
      permanent.add(message);
      permanentBounces += 1;
    }
  }
  return {
    trackable: trackable.size,
    truncated: events.truncated === true || sends.truncated === true,
    ...Object.fromEntries(DELIVERY_STATES.map((state) => [state, byState[state].size])),
    permanentBounces
  };
}

module.exports = { EVENT_TYPES, DELIVERY_STATES, TOLERANCE_SECONDS, verifySignature, receiptFrom, summarizeDelivery };
