// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Opening a hosted Stripe Checkout on a seller's own connected account.
//
// A direct charge, as lib/sonara-connected-payments.cjs explains at length: the
// call carries the seller's Stripe-Account header, so the charge is the seller's
// own and the money never enters SONARA's account. There is no application fee
// -- the marketplace takes no commission -- so there is nothing to collect and
// nothing to pay out.
//
// ## Refusing to take money that cannot be fulfilled
//
// A sale is fulfilled only by a signed webhook from the seller's account
// (routes/sonara-marketplace-checkout-routes.cjs). If the secret that verifies
// those webhooks is not configured, every payment would arrive, be unverifiable,
// and grant nothing -- the buyer would have paid for a licence the application
// cannot give them. So `checkoutReadiness` refuses until that secret exists, and
// no checkout is opened. Opening one anyway would be the exact "a signal that
// reports success without being true" this repository keeps finding, at the
// point where the false signal costs a stranger money.
//
// ## Idempotency and time
//
// The order id is the idempotency key, so a retried request returns the session
// it already created rather than a second one. The call has a deadline: a
// checkout that hangs holds a buyer on a blank page and, for an exclusive
// licence, holds the listing.

const payments = require("./sonara-connected-payments.cjs");

const STRIPE_SESSIONS = "https://api.stripe.com/v1/checkout/sessions";
const TIMEOUT_MS = 10000;
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

/**
 * Whether a marketplace checkout can be opened at all, and why not.
 */
function checkoutReadiness(deps) {
  const connect = payments.connectReadiness(deps);
  if (!connect.ok) return { ok: false, status: connect.status, detail: connect.detail };
  const secret = String(deps.getEnv("STRIPE_CONNECT_WEBHOOK_SECRET") || "");
  if (!/^whsec_[A-Za-z0-9]{16,}$/.test(secret)) {
    return {
      ok: false,
      status: "unavailable",
      detail: "STRIPE_CONNECT_WEBHOOK_SECRET is not set, so a payment could not be verified and no licence could be granted. No checkout is opened until it is."
    };
  }
  return { ok: true, status: "configured" };
}

function formBody(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.append(key, String(value));
  }
  return body.toString();
}

/**
 * Create the session. `{ ok, id, url }` or `{ ok: false, code }`.
 *
 * Never passes Stripe's error body through: it can describe the account, and a
 * buyer's page is no place for that.
 */
async function createSession(deps, { accountId, orderId, fields, idempotencyKey }, fetchImpl = fetch) {
  const ready = checkoutReadiness(deps);
  if (!ready.ok) return { ok: false, code: ready.status };
  if (!payments.ACCOUNT_ID.test(String(accountId || ""))) return { ok: false, code: "bad_account" };
  if (!orderId) return { ok: false, code: "no_order" };
  // The marketplace keys on the order alone (one checkout per order). The
  // storefront passes its own key per attempt, so a retry after an expired
  // checkout is a new session rather than Stripe replaying the expired one.
  const key = idempotencyKey || `sonara-marketplace-order-${orderId}`;
  if (!/^sonara-[a-z-]+-[0-9a-f-]{36}(-\d+)?$/.test(key)) return { ok: false, code: "bad_idempotency_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(STRIPE_SESSIONS, {
      method: "POST",
      headers: { ...payments.stripeHeaders(deps, accountId), "Idempotency-Key": key },
      body: formBody(fields),
      signal: controller.signal
    });
  } catch {
    return { ok: false, code: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
  if (!response?.ok) return { ok: false, code: "rejected", status: response?.status || 0 };
  const session = await response.json().catch(() => null);
  const url = String(session?.url || "");
  // A 200 without a usable session is a failure, not a redirect to nowhere.
  if (!SESSION_ID.test(String(session?.id || "")) || !/^https:\/\/checkout\.stripe\.com\//.test(url)) {
    return { ok: false, code: "malformed" };
  }
  return { ok: true, id: session.id, url };
}

// Existing order history must not disappear when new checkout is disabled:
// read-only GET requests remain possible with server credentials, but new
// POST checkout/expiration operations remain behind checkoutReadiness.
// This helper never creates an authenticated payment, refund or payout.
// What reconciliation and the storefront's retry need to read back. Each expands the
// payment intent's latest charge and its balance transaction, which is where Stripe
// reports the refunded amount, the fee and the net -- four levels, Stripe's limit.
const SESSION_EXPAND = "payment_intent.latest_charge.balance_transaction";

async function stripeCall(deps, accountId, url, init, fetchImpl) {
  const method = String(init?.method || "GET").toUpperCase();
  if (!payments.ACCOUNT_ID.test(String(accountId || ""))) return { ok: false, code: "bad_account" };
  if (method === "GET") {
    // Existing merchant purchases and disputes must remain independently
    // reconcilable after new Connect payment creation is disabled.
    // Only read API endpoints built internally from validated account/session
    // references can reach this helper. No user-defined URL is accepted.
    if (typeof deps?.getEnv !== "function" ||
        typeof deps.getEnv("STRIPE_SECRET_KEY") !== "string" ||
        !/^sk_(test|live)_[A-Za-z0-9]{16,}$/.test(deps.getEnv("STRIPE_SECRET_KEY"))) {
      return { ok: false, code: "legacy_reconciliation_key_unavailable" };
    }
    if (!url.startsWith(STRIPE_SESSIONS) ||
        !(url === STRIPE_SESSIONS || url.startsWith(STRIPE_SESSIONS + "?") ||
          url.startsWith(STRIPE_SESSIONS + "/"))) {
      return { ok: false, code: "non_checkout_read_prohibited" };
    }
  } else {
    // The only write made here expires an abandoned checkout session.
    // After switching to fee-only, even this mutation must not be issued.
    const ready = checkoutReadiness(deps);
    if (!ready.ok) return { ok: false, code: ready.status };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, { ...init, headers: payments.stripeHeaders(deps, accountId), signal: controller.signal });
  } catch {
    return { ok: false, code: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
  const body = await response?.json?.().catch(() => null);
  if (!response?.ok) return { ok: false, code: "rejected", status: response?.status || 0 };
  return body && typeof body === "object" ? { ok: true, body } : { ok: false, code: "malformed" };
}

/**
 * Expire an open session so it can no longer be paid. `{ ok, status }`, where
 * status is Stripe's word on the session afterwards. A session that has already
 * completed cannot be expired; Stripe refuses, and the caller re-reads it rather
 * than opening a second checkout for an order that may already be paid.
 */
async function expireSession(deps, { accountId, sessionId }, fetchImpl = fetch) {
  if (!SESSION_ID.test(String(sessionId || ""))) return { ok: false, code: "bad_session" };
  const result = await stripeCall(deps, accountId, `${STRIPE_SESSIONS}/${encodeURIComponent(sessionId)}/expire`, { method: "POST" }, fetchImpl);
  return result.ok ? { ok: true, status: String(result.body.status || "") } : result;
}

/** One session, read from Stripe with the platform key on the seller's account. */
async function retrieveSession(deps, { accountId, sessionId }, fetchImpl = fetch) {
  if (!SESSION_ID.test(String(sessionId || ""))) return { ok: false, code: "bad_session" };
  const result = await stripeCall(deps, accountId, `${STRIPE_SESSIONS}/${encodeURIComponent(sessionId)}?expand[]=${SESSION_EXPAND}`, { method: "GET" }, fetchImpl);
  if (!result.ok) return result;
  return SESSION_ID.test(String(result.body.id || "")) ? { ok: true, session: result.body } : { ok: false, code: "malformed" };
}

/**
 * Sessions created on the seller's account since `sinceSeconds`, newest first, up
 * to `maxPages` pages of 100. `truncated` says the list was longer than that --
 * reconciliation must not read "absent from what we fetched" as "absent at Stripe".
 */
async function listSessions(deps, { accountId, sinceSeconds, maxPages = 5 }, fetchImpl = fetch) {
  const sessions = [];
  let after = null;
  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ limit: "100", "created[gte]": String(Math.floor(Number(sinceSeconds) || 0)) });
    query.append("expand[]", `data.${SESSION_EXPAND}`);
    if (after) query.set("starting_after", after);
    const result = await stripeCall(deps, accountId, `${STRIPE_SESSIONS}?${query.toString()}`, { method: "GET" }, fetchImpl);
    if (!result.ok) return result;
    const data = Array.isArray(result.body.data) ? result.body.data : null;
    if (!data) return { ok: false, code: "malformed" };
    sessions.push(...data);
    if (!result.body.has_more || !data.length) return { ok: true, sessions, truncated: false };
    after = data[data.length - 1].id;
  }
  return { ok: true, sessions, truncated: true };
}

module.exports = { checkoutReadiness, createSession, expireSession, retrieveSession, listSessions, formBody, TIMEOUT_MS, STRIPE_SESSIONS, SESSION_EXPAND };
