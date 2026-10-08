// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// POST /api/webhooks/resend: what happened to a campaign email after the
// provider accepted it.
//
// Mounted in server.js with express.raw before the body parsers, like the two
// Stripe webhooks, because a parsed body cannot be verified.
//
// The order is the point:
//   1. verify the signature, or answer 401 and read nothing;
//   2. turn the event into a receipt, or acknowledge it and record nothing;
//   3. find the campaign send it belongs to by the provider's message id;
//   4. insert one row, keyed on the event id so a resend is a duplicate.
// A failed read or write answers 503, which the provider retries. An event for a
// message that is not a campaign send -- a sign-in email, an invoice -- is
// acknowledged and not recorded.

const receipts = require("../lib/sonara-email-delivery-receipts.cjs");

const SENDS_TABLE = "growth_campaign_sends";
const EVENTS_TABLE = "growth_email_delivery_events";

function createReceiptWebhookHandler(deps = {}) {
  for (const name of ["getEnv", "getSupabaseServerConfig", "supabaseHeaders"]) {
    if (typeof deps[name] !== "function") throw new TypeError(`createReceiptWebhookHandler requires ${name}`);
  }
  const { getEnv, getSupabaseServerConfig, supabaseHeaders } = deps;
  const enc = encodeURIComponent;

  async function call(config, pathAndQuery, init = {}) {
    try {
      const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
        method: init.method || "GET",
        headers: supabaseHeaders(config, init.prefer ? { prefer: init.prefer } : {}),
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });
      const rows = init.method ? [] : await response.json().catch(() => null);
      return { ok: response.ok && (init.method ? true : Array.isArray(rows)), rows: Array.isArray(rows) ? rows : [] };
    } catch {
      return { ok: false, rows: [] };
    }
  }

  return async function handleReceipt(req, res) {
    const verified = receipts.verifySignature({
      secret: getEnv("RESEND_WEBHOOK_SECRET"),
      id: req.get("svix-id"),
      timestamp: req.get("svix-timestamp"),
      signature: req.get("svix-signature"),
      body: req.body
    });
    if (!verified.ok) {
      // Not configured is the operator's to fix and the provider should retry
      // once it is; anything else is a request that is not from the provider.
      return res.status(verified.code === "not_configured" ? 503 : 401).json({ ok: false, code: verified.code });
    }

    let event;
    try {
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || ""));
    } catch {
      return res.status(400).json({ ok: false, code: "unreadable" });
    }
    const receipt = receipts.receiptFrom(event);
    if (receipt.ignore) return res.status(200).json({ ok: true, ignored: receipt.ignore });

    const config = getSupabaseServerConfig();
    if (!config?.ok) return res.status(503).json({ ok: false, code: "unavailable" });

    // Found by the provider's message id, which is unique to one accepted send.
    // The organization and campaign come from that row, never from the event.
    const found = await call(config, `${SENDS_TABLE}?select=organization_id,campaign_id,email&provider_message_id=eq.${enc(receipt.record.provider_message_id)}&status=eq.accepted&limit=1`);
    if (!found.ok) return res.status(503).json({ ok: false, code: "unreadable" });
    const send = found.rows[0];
    if (!send) return res.status(200).json({ ok: true, ignored: "not_a_campaign_email" });

    const saved = await call(config, `${EVENTS_TABLE}?on_conflict=provider_event_id`, {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        organization_id: send.organization_id,
        campaign_id: send.campaign_id,
        provider_message_id: receipt.record.provider_message_id,
        provider_event_id: String(req.get("svix-id")),
        event_type: receipt.record.event_type,
        bounce_type: receipt.record.bounce_type,
        email: send.email,
        occurred_at: receipt.record.occurred_at
      }
    });
    if (!saved.ok) return res.status(503).json({ ok: false, code: "not_saved" });
    return res.status(200).json({ ok: true, recorded: receipt.record.event_type });
  };
}

module.exports = { createReceiptWebhookHandler };
