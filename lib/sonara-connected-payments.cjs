"use strict";

// Being paid by your own customers.
//
// Until this module, the largest thing this application could not do: a plumber
// could raise an invoice and never collect against it, and a creator could list
// a product and never sell it. `lib/sonara-invoice-settlement.cjs` records the
// reason in its own comment -- there was no Stripe Connect here, so a pay button
// "would take a small business's customer's money into SONARA's account with no
// mechanism to pay it out. That is money custody, not a missing endpoint."
//
// This is the answer to that objection rather than a way around it.
//
// ## Direct charges, which is the whole design
//
// A charge is created **on the connected account**, by sending Stripe's
// `Stripe-Account` header. Stripe treats it as the business's own charge: the
// funds land in the business's Stripe balance, the business's payout schedule
// applies, and the money never enters SONARA's account at any point. There is
// nothing to pay out because nothing was ever held.
//
// The alternative -- destination charges with `transfer_data` -- puts the money
// on the platform first. That is a money-transmission posture with registration
// and reconciliation attached, and it is not what a small operator needs. The
// database constraint refuses any mode but `direct`, so switching is a
// migration somebody writes and a reviewer sees.
//
// ## What this deliberately does not do
//
// **No card data ever reaches this application.** AGENTS.md forbids storing raw
// card data or CVV, and the way to honour that reliably is to never be in the
// path: onboarding runs on Stripe's hosted flow, and the payment itself runs on
// Stripe Checkout. This module handles identifiers and states, never a PAN,
// never a CVV, never a token that could stand in for one.
//
// **No pay button on `/shared/:token`.** That link's footnote tells its reader
// to pay the way they agreed with the business and never from a link, because a
// forwarded invoice carrying a pay button is the exact shape of a payment
// redirection fraud. Advice like that only works while it is always true -- a
// product where some shared invoices have a pay button has taught its customers
// that a pay button on a forwarded invoice is normal, which is the lesson the
// fraud depends on. So payment is something the business initiates from inside
// its own workspace, and the shared link stays what it is: a statement.
//
// **No cached state trusted for a decision.** The three flags on the row exist
// to render a list without a network call per row. Every decision that gates
// money re-reads Stripe, because a stale `charges_enabled: true` renders a pay
// button over an account that cannot take money -- which fails in front of the
// customer, at the till.

const REQUIRED = Object.freeze(["getEnv", "serviceRoleHeaders", "supabaseUrl"]);

const STRIPE_API = "https://api.stripe.com/v1";

// Stripe's account ids. Checked before an id is put into a URL rather than
// after Stripe rejects it, so the failure names the cause.
const ACCOUNT_ID = /^acct_[A-Za-z0-9]{8,}$/;

// Long enough to complete Stripe's onboarding in one sitting, short enough that
// a link left in a browser tab is not a lasting way into the account. Stripe
// expires account links itself; this is the figure used when asking for one.
const ONBOARDING_LINK_SECONDS = 300;

/**
 * Whether connected payments are configured, and what is missing if not.
 *
 * Three states, not two. `setup_required` means the owner has not switched this
 * on; `unavailable` means it is on and something it needs is absent. A page
 * that showed the same message for both would send a business owner to enable
 * something already enabled.
 */
function connectReadiness(deps) {
  const getEnv = deps?.getEnv;
  if (typeof getEnv !== "function") {
    return { ok: false, status: "unavailable", detail: "No environment reader was supplied to this module." };
  }
  // Deliberately opt-in. Stripe Connect has to be enabled on the platform
  // account before any of these calls succeed, and that is a dashboard step
  // nobody here can perform or verify. Defaulting to on would render a connect
  // button that fails at Stripe with a message a business owner cannot act on.
  const enabled = String(getEnv("STRIPE_CONNECT_ENABLED") || "").toLowerCase();
  if (enabled !== "true" && enabled !== "1") {
    return {
      ok: false,
      status: "setup_required",
      detail: "Connected payments are off. Enable Stripe Connect on the platform account, then set STRIPE_CONNECT_ENABLED=true."
    };
  }
  const secret = getEnv("STRIPE_SECRET_KEY");
  if (!secret || String(secret).startsWith("sk_test_placeholder") || String(secret).length < 20) {
    return {
      ok: false,
      status: "unavailable",
      detail: "STRIPE_CONNECT_ENABLED is set but STRIPE_SECRET_KEY is missing or a placeholder, so no connected account can be reached."
    };
  }
  return {
    ok: true,
    status: "configured",
    // Said out loud rather than assumed. Nothing here can see the platform
    // account's Connect settings, and a platform with Connect disabled fails at
    // the first API call with an error the customer should never be shown.
    assumes: "Stripe Connect is enabled on the platform account. Nothing here can verify that; the first onboarding attempt is what proves it."
  };
}

function stripeHeaders(deps, accountId) {
  const headers = {
    Authorization: `Bearer ${deps.getEnv("STRIPE_SECRET_KEY")}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };
  // The header that makes a call act *as* the connected account rather than as
  // the platform. Its absence is the difference between a direct charge and a
  // platform charge, so it is never optional where it belongs.
  if (accountId) headers["Stripe-Account"] = accountId;
  return headers;
}

/**
 * Read one organization's connected account row.
 *
 * Returns `{ ok, account }` where `ok` is false when the read itself failed.
 * `ok: true, account: null` means the organization has no connected account,
 * which is a different thing from not being able to tell -- and this repository
 * has shipped the bug where those two are the same value more than once.
 */
async function readAccount(deps, organizationId, fetchImpl = fetch) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  const url =
    `${deps.supabaseUrl}/rest/v1/business_payment_accounts` +
    `?organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&disconnected_at=is.null&select=*&limit=1`;
  let response;
  try {
    response = await fetchImpl(url, { headers: deps.serviceRoleHeaders() });
  } catch {
    return { ok: false, code: "unreadable" };
  }
  if (!response?.ok) return { ok: false, code: "unreadable" };
  let rows;
  try {
    rows = await response.json();
  } catch {
    return { ok: false, code: "unreadable" };
  }
  if (!Array.isArray(rows)) return { ok: false, code: "unreadable" };
  return { ok: true, account: rows[0] || null };
}

/**
 * Ask Stripe what a connected account can actually do, right now.
 *
 * This is the read every money decision goes through. It never falls back to
 * the cached columns: a cache that stands in when the network fails turns "we
 * could not ask" into "yes", which is the failure that puts a pay button over
 * an account that cannot take money.
 */
async function liveAccountState(deps, accountId, fetchImpl = fetch) {
  if (!ACCOUNT_ID.test(String(accountId || ""))) return { ok: false, code: "bad_account_id" };
  let response;
  try {
    response = await fetchImpl(`${STRIPE_API}/accounts/${encodeURIComponent(accountId)}`, {
      headers: stripeHeaders(deps)
    });
  } catch {
    return { ok: false, code: "stripe_unreachable" };
  }
  if (!response?.ok) return { ok: false, code: "stripe_refused", status: response?.status ?? null };
  let account;
  try {
    account = await response.json();
  } catch {
    return { ok: false, code: "stripe_unreadable" };
  }
  if (!account || typeof account !== "object") return { ok: false, code: "stripe_unreadable" };
  // Read as three-state rather than coerced. Stripe omits these on some account
  // types, and `Boolean(undefined)` is false -- which would report a working
  // account as unable to take charges.
  const flag = (value) => (typeof value === "boolean" ? value : null);
  return {
    ok: true,
    accountId,
    chargesEnabled: flag(account.charges_enabled),
    payoutsEnabled: flag(account.payouts_enabled),
    detailsSubmitted: flag(account.details_submitted),
    // What Stripe still wants. Shown to the owner verbatim rather than
    // summarised as "incomplete", because "upload a document" and "confirm your
    // bank account" are different afternoons.
    requirementsDue: Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due : [],
    requirementsDisabledReason: account.requirements?.disabled_reason || null
  };
}

/**
 * Whether this organization may be paid, and why not when it may not.
 *
 * The single function every payment path asks. It returns a reason code in
 * every refusal, because "you cannot take payments" with no cause is a message
 * a business owner cannot act on.
 */
async function canAcceptPayments(deps, organizationId, fetchImpl = fetch) {
  const readiness = connectReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };

  const stored = await readAccount(deps, organizationId, fetchImpl);
  if (!stored.ok) return { ok: false, code: "account_unreadable", detail: "Could not read whether this workspace has a connected account." };
  if (!stored.account) {
    return { ok: false, code: "not_connected", detail: "This workspace has not connected a payment account yet." };
  }

  const live = await liveAccountState(deps, stored.account.stripe_account_id, fetchImpl);
  if (!live.ok) {
    return { ok: false, code: live.code, detail: "Stripe could not be asked whether this account can take payments, so nothing here will claim it can." };
  }
  if (live.chargesEnabled !== true) {
    return {
      ok: false,
      code: "charges_disabled",
      detail: live.requirementsDisabledReason
        ? `Stripe has not enabled charges on this account: ${live.requirementsDisabledReason}.`
        : "Stripe has not enabled charges on this account yet.",
      requirementsDue: live.requirementsDue
    };
  }
  return {
    ok: true,
    accountId: live.accountId,
    // Reported, never gated on. A business can take a card before its first
    // payout is enabled, and refusing the charge because payouts are pending
    // would stop it being paid at all rather than stop it being paid promptly.
    payoutsEnabled: live.payoutsEnabled,
    requirementsDue: live.requirementsDue
  };
}

/**
 * Create a connected account for an organization that has none.
 *
 * Stripe is asked for a Standard account: the business owns the relationship,
 * gets its own Stripe dashboard, and handles its own disputes. That is the
 * right default for a tool a small operator adopts alongside things they
 * already run, and it is the mode with the least of somebody else's money and
 * liability passing through this application.
 */
async function createAccount(deps, { organizationId, country, email, createdBy }, fetchImpl = fetch) {
  const readiness = connectReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };
  if (!organizationId) return { ok: false, code: "no_organization" };

  const existing = await readAccount(deps, organizationId, fetchImpl);
  if (!existing.ok) return { ok: false, code: "account_unreadable" };
  if (existing.account) return { ok: false, code: "already_connected", accountId: existing.account.stripe_account_id };

  const body = new URLSearchParams({ type: "standard" });
  // Only sent when supplied. An empty `country` is not the same as "use
  // Stripe's default", and sending a blank one is an error at Stripe rather
  // than a silent default.
  if (country) body.set("country", String(country).toUpperCase().slice(0, 2));
  if (email) body.set("email", String(email).slice(0, 320));

  let response;
  try {
    response = await fetchImpl(`${STRIPE_API}/accounts`, { method: "POST", headers: stripeHeaders(deps), body });
  } catch {
    return { ok: false, code: "stripe_unreachable" };
  }
  if (!response?.ok) {
    // Stripe's error body can name the platform account and its configuration.
    // The code is carried, the body is not.
    return { ok: false, code: "stripe_refused", status: response?.status ?? null };
  }
  let account;
  try {
    account = await response.json();
  } catch {
    return { ok: false, code: "stripe_unreadable" };
  }
  if (!ACCOUNT_ID.test(String(account?.id || ""))) return { ok: false, code: "stripe_unreadable" };

  // Written to our side only after Stripe has confirmed the account exists.
  // The other order leaves a row pointing at an account that was never created,
  // and a workspace that believes it is connected.
  const insert = await fetchImpl(`${deps.supabaseUrl}/rest/v1/business_payment_accounts`, {
    method: "POST",
    headers: { ...deps.serviceRoleHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      organization_id: organizationId,
      stripe_account_id: account.id,
      charges_mode: "direct",
      created_by: createdBy || null
    })
  }).catch(() => undefined);

  if (!insert?.ok) {
    // The Stripe account now exists and this side does not know about it. Said
    // plainly, with the id, because the recovery is to record that id rather
    // than to create a second account -- and a second account is what a retry
    // would produce.
    return { ok: false, code: "account_created_but_not_recorded", accountId: account.id };
  }
  return { ok: true, accountId: account.id };
}

/**
 * A link that sends the owner to Stripe to finish onboarding.
 *
 * Account links are single-use and short-lived by design at Stripe. This never
 * stores one: a stored onboarding link is a credential with a URL's handling.
 */
async function onboardingLink(deps, { accountId, returnUrl, refreshUrl }, fetchImpl = fetch) {
  const readiness = connectReadiness(deps);
  if (!readiness.ok) return { ok: false, code: readiness.status, detail: readiness.detail };
  if (!ACCOUNT_ID.test(String(accountId || ""))) return { ok: false, code: "bad_account_id" };
  if (!returnUrl || !refreshUrl) return { ok: false, code: "no_return_url" };

  const body = new URLSearchParams({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl
  });

  let response;
  try {
    response = await fetchImpl(`${STRIPE_API}/account_links`, { method: "POST", headers: stripeHeaders(deps), body });
  } catch {
    return { ok: false, code: "stripe_unreachable" };
  }
  if (!response?.ok) return { ok: false, code: "stripe_refused", status: response?.status ?? null };
  let link;
  try {
    link = await response.json();
  } catch {
    return { ok: false, code: "stripe_unreadable" };
  }
  const url = String(link?.url || "");
  // Checked rather than trusted. This URL is about to be a redirect target, and
  // a redirect to whatever came back in a JSON field is an open redirect with
  // extra steps.
  if (!url.startsWith("https://connect.stripe.com/")) return { ok: false, code: "stripe_unreadable" };
  return { ok: true, url, expiresInSeconds: ONBOARDING_LINK_SECONDS };
}

/**
 * Write Stripe's answers onto the row so a list can be rendered without a call
 * per account.
 *
 * All four columns move together or none does. The database constraint enforces
 * that too; doing it here as well means the failure is a refusal with a reason
 * rather than a constraint violation somebody has to decode.
 */
async function cacheAccountState(deps, { organizationId, state }, fetchImpl = fetch) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  if (!state?.ok) return { ok: false, code: "no_state_to_cache" };
  const url =
    `${deps.supabaseUrl}/rest/v1/business_payment_accounts` +
    `?organization_id=eq.${encodeURIComponent(organizationId)}&disconnected_at=is.null`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "PATCH",
      headers: { ...deps.serviceRoleHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        charges_enabled: state.chargesEnabled,
        payouts_enabled: state.payoutsEnabled,
        details_submitted: state.detailsSubmitted,
        state_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
  } catch {
    return { ok: false, code: "unwritable" };
  }
  if (!response?.ok) return { ok: false, code: "unwritable" };
  return { ok: true };
}

/**
 * Stop using a connected account.
 *
 * The row is marked rather than deleted. A deleted row makes a reconnect look
 * like a first connection and leaves any payment that went through the old
 * account pointing at nothing. Stripe is not asked to delete anything: the
 * account belongs to the business, not to this platform, and removing their
 * access to their own payment history is not this application's to do.
 */
async function disconnect(deps, organizationId, fetchImpl = fetch) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  const url =
    `${deps.supabaseUrl}/rest/v1/business_payment_accounts` +
    `?organization_id=eq.${encodeURIComponent(organizationId)}&disconnected_at=is.null`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "PATCH",
      headers: { ...deps.serviceRoleHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
  } catch {
    return { ok: false, code: "unwritable" };
  }
  if (!response?.ok) return { ok: false, code: "unwritable" };
  return { ok: true };
}

module.exports = {
  REQUIRED,
  ACCOUNT_ID,
  ONBOARDING_LINK_SECONDS,
  connectReadiness,
  readAccount,
  liveAccountState,
  canAcceptPayments,
  createAccount,
  onboardingLink,
  cacheAccountState,
  disconnect
};
