// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const checkout = require("../lib/sonara-connected-checkout.cjs");
const payments = require("../lib/sonara-connected-payments.cjs");
const orders = require("../lib/sonara-marketplace-orders.cjs");
const report = require("../lib/sonara-marketplace-reconciliation.cjs");
const RECONCILIATION_PAGE = "/creator-studio/owner/marketplace/reconciliation";
const ORDER_LIMIT = 200;

function money(minor, currency) {
  try {
    const format = new Intl.NumberFormat("en", { style: "currency", currency });
    // Stripe keeps ISK/UGX API amounts in two decimals for compatibility even
    // though Intl formats their displayed currency with zero decimal places.
    // https://docs.stripe.com/currencies#special-cases
    const digits = ["isk", "ugx"].includes(String(currency).toLowerCase())
      ? 2 : format.resolvedOptions().maximumFractionDigits;
    return format.format(minor / (10 ** digits));
  } catch {
    return String(minor) + " minor units " + String(currency || "").toUpperCase();
  }
}

function registerMarketplaceReconciliationRoutes(app, deps) {
  const { layout, linkAction, escapeHtml, requireWorkspaceAccess,
    getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders } = deps;
  const getEnv = deps.getEnv || (() => "");
  const enc = encodeURIComponent;
  // The shared brandCard accepts plain text. These cards contain lists and
  // paragraphs; every record value is escaped before joining that markup.
  const card = (title, body) => '<section class="card"><h2>' + escapeHtml(title)
    + '</h2><div class="card-content">' + body + "</div></section>";
  const page = (res, status, body, sections = []) => res.status(status).type("html").send(layout({
    title: "Marketplace reconciliation", eyebrow: "Creator Studio",
    heading: "Check sales and licences", body, sections,
    actions: [linkAction("/creator-studio/owner/marketplace", "Your marketplace"),
      linkAction("/business-builder/owner/payments", "Payment account")]
  }));

  async function read(pathAndQuery) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false };
    try {
      const response = await fetch(config.url + "/rest/v1/" + pathAndQuery,
        { headers: supabaseHeaders(config), signal: AbortSignal.timeout(5000) });
      const rows = response.ok ? await response.json().catch(() => null) : null;
      return Array.isArray(rows) ? { ok: true, rows } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  app.get(RECONCILIATION_PAGE, requireWorkspaceAccess("creator_studio"), async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const days = req.query?.days === undefined ? 30 : Number(req.query.days);
    if (![7, 30, 90].includes(days)) return page(res, 400, "Choose a period of 7, 30 or 90 days.");
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization?.ok || !orders.isUuid(organization.organizationId)) {
      return page(res, 503, "We could not identify your workspace. No sales or payment records were read.");
    }
    const organizationId = organization.organizationId;
    const sinceSeconds = Math.floor(Date.now() / 1000) - days * 86400;
    const since = new Date(sinceSeconds * 1000).toISOString();
    const [sold, accounts] = await Promise.all([
      read("creator_marketplace_orders?select=id,organization_id,title,version_id,buyer_user_id,licence,price_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,state"
        + "&organization_id=eq." + enc(organizationId) + "&created_at=gte." + enc(since) + "&order=created_at.desc&limit=201"),
      read("business_payment_accounts?select=organization_id,stripe_account_id&organization_id=eq." + enc(organizationId) + "&disconnected_at=is.null&limit=2")
    ]);
    if (!sold.ok || !accounts.ok) return page(res, 503, "Your sales or payment account could not be read. This does not mean there were no sales.");
    if (!accounts.rows.length) return page(res, 200, "Connect your payment account before checking these sales against Stripe. Payment and licence reconciliation has not run.");
    const account = accounts.rows[0];
    if (accounts.rows.length !== 1 || account.organization_id !== organizationId
      || !payments.ACCOUNT_ID.test(String(account.stripe_account_id || ""))) {
      return page(res, 503, "Your payment account could not be verified. Reconciliation has not run.");
    }
    if (!checkout.checkoutReadiness({ getEnv }).ok) return page(res, 503, "The payment connection is unavailable. Stripe records have not been checked.");
    const orderRows = sold.rows.slice(0, ORDER_LIMIT);
    if (orderRows.some((order) => !orders.isUuid(order.id) || order.organization_id !== organizationId)) {
      return page(res, 503, "The sales records could not be verified for your workspace. Reconciliation has not run.");
    }
    const ids = orderRows.map((order) => order.id).join(",");
    const [grants, stripe] = await Promise.all([
      ids ? read("creator_licence_grants?select=order_id,organization_id,buyer_user_id,version_id,licence,revoked_at,revoked_reason"
        + "&organization_id=eq." + enc(organizationId) + "&order_id=in.(" + enc(ids) + ")&limit=201") : Promise.resolve({ ok: true, rows: [] }),
      checkout.listSessions({ getEnv }, { accountId: account.stripe_account_id, sinceSeconds, maxPages: 5 })
    ]);
    if (!grants.ok || !stripe.ok) return page(res, 503, "The licence records or Stripe check failed. No reconciliation result is claimed; try again shortly.");
    let evidence;
    try {
      evidence = report.reconcile({ organizationId, accountId: account.stripe_account_id,
        orderRows, grants: grants.rows.slice(0, ORDER_LIMIT), sessions: stripe.sessions,
        ordersTruncated: sold.rows.length > ORDER_LIMIT,
        sessionsTruncated: stripe.truncated, grantsComplete: grants.rows.length <= ORDER_LIMIT });
    } catch {
      return page(res, 503, "The records could not be verified for your workspace. Reconciliation has not run.");
    }
    const h = escapeHtml;
    const sections = [
      '<form class="card" method="get" action="' + RECONCILIATION_PAGE + '"><label>Orders created in the last<select name="days">'
        + [7, 30, 90].map((value) => '<option value="' + value + '"' + (days === value ? " selected" : "") + ">" + value + " days</option>").join("")
        + '</select></label><button type="submit">Check again</button></form>',
      card(evidence.complete ? "Records checked" : "Partial check",
        h(evidence.checked + " orders checked without a mismatch; " + evidence.attention + " records need attention.")
        + (evidence.ordersTruncated ? "<p>Only the newest 200 orders are shown. Choose a shorter period.</p>" : "")
        + (evidence.sessionsTruncated ? "<p>Stripe has more than 500 checkouts in this period. Missing payments are unverified until a shorter period can be read in full.</p>" : "")
        + (!evidence.grantsComplete ? "<p>The licence list is incomplete. Missing grants are unverified.</p>" : "")),
      card("What this check means", "Orders created in the last " + days
        + " days are compared with the current connected account and recorded licence grants. This page reads records only. To resolve a payment issue, review its payment notification and the charge in your Stripe account."
        + "<p>These are sales and original charge records. They do not establish bank payout, withdrawable funds or profit.</p>")
    ];
    for (const [currency, total] of Object.entries(evidence.totals)) {
      sections.push(card(currency.toUpperCase() + " sales read",
        h("Recorded paid orders: " + money(total.localPaid, currency)
          + ". Stripe paid checkouts: " + money(total.stripePaid, currency)
          + ". Known refunds on those charges: " + money(total.refunded, currency) + ".")
        + (evidence.unknownRefunds ? "<p>Refund details are unavailable for " + evidence.unknownRefunds + " paid checkouts. The known refund amount is partial.</p>" : "")));
    }
    for (const [currency, balance] of Object.entries(evidence.balances)) {
      sections.push(card(currency.toUpperCase() + " original charge balance",
        h("Stripe fee: " + money(balance.fee, currency) + ". Original charge net: " + money(balance.net, currency)
          + ". " + balance.charges + " charge records. Later refunds and disputes are excluded.")));
    }
    if (evidence.unknownBalances) sections.push(card("Some fee records are unavailable",
      h(evidence.unknownBalances + " paid checkouts have no expanded fee and net record. No zero fee is assumed.")));
    if (!evidence.rows.length) sections.push(card("No records in this period", "No marketplace orders or Stripe marketplace checkouts were returned for the period checked."));
    for (const row of evidence.rows) {
      const findings = row.codes.length
        ? "<ul>" + row.codes.map((code) => "<li>" + h(report.FINDINGS[code]) + "</li>").join("") + "</ul>"
        : row.waiting ? "<p>Payment is not confirmed yet. No active licence is recorded.</p>"
          : "<p>The payment record and licence state agree with this order.</p>";
      sections.push(card(row.title || "Untitled purchase",
        "<p>Order " + h(row.orderId) + " — " + h(row.state) + (row.licence ? ", " + h(row.licence.replace(/_/g, " ")) : "") + ".</p>"
        + (row.payment ? "<p>Stripe checkout " + h(row.payment.id) + ".</p>" : "") + findings));
    }
    return page(res, 200, "Compare each sale with Stripe and the licence the buyer purchased. Findings show where the workflow still needs attention.", sections);
  });
}

module.exports = { registerMarketplaceReconciliationRoutes, RECONCILIATION_PAGE };
