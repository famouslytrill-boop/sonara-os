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
async function createSession(deps, { accountId, orderId, fields }, fetchImpl = fetch) {
  const ready = checkoutReadiness(deps);
  if (!ready.ok) return { ok: false, code: ready.status };
  if (!payments.ACCOUNT_ID.test(String(accountId || ""))) return { ok: false, code: "bad_account" };
  if (!orderId) return { ok: false, code: "no_order" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(STRIPE_SESSIONS, {
      method: "POST",
      headers: { ...payments.stripeHeaders(deps, accountId), "Idempotency-Key": `sonara-marketplace-order-${orderId}` },
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

module.exports = { checkoutReadiness, createSession, formBody, TIMEOUT_MS, STRIPE_SESSIONS };
