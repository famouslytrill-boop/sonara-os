"use strict";

// Connecting a payment account, so a business can be paid by its own customers.
//
// `lib/sonara-connected-payments.cjs` can create a connected account, ask Stripe
// what it can do, and record the answer. This is the reachable half -- without
// it the module would be exactly the defect this codebase keeps finding: a
// capability that exists, passes its tests, and no customer can get to.
//
// ## Why this page says so much
//
// Most owner pages here are a list and a form. This one is four sentences of
// explanation before a single button, and that is deliberate: it is the page
// where somebody connects the account their income arrives in. The two
// questions a person actually has -- *where does the money go* and *what can
// SONARA do with it* -- are answered on the page rather than in terms nobody
// reads, because a payment setup screen that does not answer them is one a
// careful person abandons.
//
// The answers are short and both are true of the code:
//
//   Money goes straight to the business's own Stripe account. Charges are
//   created **on** the connected account, so funds never enter SONARA's balance
//   and there is nothing for SONARA to pay out.
//
//   Disconnecting is always available and never touches the Stripe account
//   itself. The account belongs to the business.
//
// ## What is NOT here
//
// There is no pay button, and no page under this file collects a payment.
// Connecting an account and taking a payment are separate pieces of work, and
// this is the first. Shipping a connect flow with a pay button attached would
// mean shipping a payment path whose refund, dispute and receipt behaviour
// nobody has designed yet.
//
// In particular the shared invoice at `/shared/:token` does not gain a pay
// button from this and must not. Its footnote tells the reader to pay the way
// they agreed with the business and never from a link, because a forwarded
// invoice carrying a pay button is the shape of a payment-redirection fraud.
// That advice only protects anybody while it is always true.

const payments = require("../lib/sonara-connected-payments.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

const REQUIRED = [
  "layout", "brandCard", "escapeHtml",
  "requireCustomer", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders", "getEnv"
];

const PAGE = "/business-builder/owner/payments";

// What each refusal means in a sentence the person reading it can act on. A
// code with no sentence beside it is a page that tells somebody something is
// wrong and not what to do about it.
const EXPLAIN = Object.freeze({
  setup_required: "Connected payments are not switched on for this platform yet. This is an owner step, not something you have done wrong.",
  unavailable: "Connected payments are switched on but the platform is missing a Stripe key, so no account can be reached.",
  not_connected: "This workspace has not connected a payment account yet.",
  account_unreadable: "We could not read whether this workspace has a connected account. This says nothing about your account — only that we could not check.",
  stripe_unreachable: "Stripe could not be reached, so nothing here will claim your account can or cannot take payments.",
  stripe_refused: "Stripe refused the request. Nothing has changed.",
  stripe_unreadable: "Stripe answered with something this could not read. Nothing has changed.",
  charges_disabled: "Stripe has not enabled charges on this account yet.",
  bad_account_id: "The stored account identifier is not one Stripe would recognise.",
  already_connected: "This workspace already has a connected account.",
  account_created_but_not_recorded:
    "Stripe created the account and this application could not record it. Do not press connect again — that would create a second account. Send the identifier below to support.",
  no_return_url: "This page could not work out where Stripe should send you back to.",
  unwritable: "The change could not be saved. Nothing was altered.",
  no_organization: "This sign-in is not attached to a workspace yet."
});

function explain(code) {
  return EXPLAIN[code] || "Something went wrong and nothing was changed.";
}

module.exports = function registerConnectedPaymentRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerConnectedPaymentRoutes requires ${name}`);
  }
  const {
    layout, brandCard, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getEnv
  } = deps;

  // The shape lib/sonara-connected-payments.cjs expects. Built per request
  // rather than once, because getSupabaseServerConfig reads the environment and
  // a value captured at module load would be the value at cold start.
  function moduleDeps() {
    const config = getSupabaseServerConfig();
    if (!config?.url) return null;
    return {
      getEnv,
      supabaseUrl: config.url,
      serviceRoleHeaders: () => supabaseHeaders(config)
    };
  }

  // Takes the *user* and answers `{ ok, organizationId }`. Passing `req` here
  // and using the answer as a string filters on `organization_id=eq.[object
  // Object]`, which returns no rows and looks exactly like a working boundary.
  async function organizationFor(req) {
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    const organization = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!organization?.ok || !organization.organizationId) return null;
    return organization.organizationId;
  }

  // One definition of "where does this site live", in lib/sonara-site-origin.cjs.
  // This had its own copy and server.js grew a second one; two are one more
  // than a deployment can keep consistent. Used only to build the return
  // address Stripe sends the owner back to.
  const baseUrl = (req) => siteOrigin(req, getEnv);

  // `actions` is not optional.
  //
  // lib/sonara-page-frame.cjs:234 does `actions.join("")` unconditionally, so
  // omitting it throws TypeError before a byte is written and every request to
  // this page 500s. The first draft omitted it, the page rendered nowhere, and
  // tests/signed-in-workspace-crawl.test.js is what caught it -- a crawl that
  // opens every registered page and refuses anything that is not a render, a
  // redirect, a paid-plan boundary or a stated setup-required.
  //
  // Worth recording because the failure is invisible to a reader: the call site
  // looks complete, and the missing key is only a problem two files away.
  function shell(sections, { title = "Getting paid", eyebrow = "Business Builder", heading = "Getting paid", actions = [] } = {}) {
    return layout({ title, eyebrow, heading, body: "", sections, actions });
  }

  // Every button here posts, and `linkAction(href, label)` renders an anchor.
  //
  // Written after the first draft passed `{ method: "post" }` as a third
  // argument -- which linkAction does not take and silently ignores, producing
  // a GET link to a POST-only route. The page would have rendered perfectly and
  // every button would have 404'd. Caught by reading the helper's signature
  // rather than by a test, which is the second time on this branch that reading
  // the helper was what found it.
  //
  // These are state-changing actions, so a form is the correct element anyway:
  // an anchor invites a prefetcher to connect a payment account by hovering.
  function postButton(action, label) {
    return `<form method="post" action="${escapeHtml(action)}"><button class="action" type="submit">${escapeHtml(label)}</button></form>`;
  }

  // The explanation that appears whatever state the account is in. Written once
  // so the two questions are answered identically on every path -- a page that
  // explains custody only in the happy state has explained it to nobody who was
  // worried.
  function howMoneyMoves() {
    return brandCard(
      "Where the money goes",
      "Payments go straight into your own Stripe account. Charges are created on your account, so the money never passes through SONARA and there is nothing for us to pay out to you. " +
      "You keep your own Stripe dashboard, your own payout schedule, and your own disputes. You can disconnect at any time, and disconnecting does not touch your Stripe account — it belongs to you, not to us."
    );
  }

  function notAPayButton() {
    return brandCard(
      "This connects an account. It does not add a pay button",
      "Invoices you share stay statements. We deliberately never put a pay button on a shared invoice link, because a forwarded invoice with a pay button is exactly what payment-redirection fraud looks like, and that advice only protects your customers while it is always true."
    );
  }

  /**
   * What was true when Stripe was last asked, and when that was.
   *
   * Three states per flag, not two: `true`, `false`, and null for never asked.
   * The column comments in the migration say the same thing -- "null means
   * never asked, false means Stripe said no" -- because "payouts disabled" and
   * "we have not checked" lead a business owner to do completely different
   * things.
   */
  function lastKnown(account) {
    const when = String(account.state_checked_at || "").replace("T", " ").slice(0, 16);
    const say = (value, yes, no) => (value === true ? yes : value === false ? no : null);
    const parts = [
      say(account.charges_enabled, "charges were enabled", "charges were not enabled"),
      say(account.payouts_enabled, "payouts were enabled", "payouts were not enabled")
    ].filter(Boolean);
    if (!parts.length) return `We last asked Stripe on ${when}, and it did not say what this account can do.`;
    return `When we last asked Stripe, on ${when}, ${parts.join(" and ")}. That is not the same as what is true now.`;
  }

  app.get(PAGE, requireCustomer, async (req, res) => {
    const sections = [howMoneyMoves(), notAPayButton()];

    const mod = moduleDeps();
    if (!mod) {
      sections.unshift(brandCard("Not configured", "This workspace has no database connection configured, so nothing about payments can be read."));
      return res.status(503).type("html").send(shell(sections));
    }

    const readiness = payments.connectReadiness(mod);
    if (!readiness.ok) {
      sections.unshift(brandCard("Not available yet", `${escapeHtml(readiness.detail)} ${escapeHtml(explain(readiness.status))}`));
      // 200 rather than an error status. Nothing is broken -- the owner has not
      // finished a setup step, and a 5xx would tell a customer their workspace
      // is faulty.
      return res.status(200).type("html").send(shell(sections));
    }

    const organizationId = await organizationFor(req);
    if (!organizationId) {
      sections.unshift(brandCard("No workspace", escapeHtml(explain("no_organization"))));
      return res.status(200).type("html").send(shell(sections));
    }

    const answer = await payments.canAcceptPayments(mod, organizationId);

    // Remember what Stripe just said, so the branch at the bottom of this
    // handler has something to fall back on next time Stripe cannot be reached.
    // Deliberately not awaited for its result: this is a page render, and a
    // failed cache write must not turn a working page into an error. The page
    // shows Stripe's live answer either way.
    if (answer.state?.ok) {
      await payments.cacheAccountState(mod, { organizationId, state: answer.state }).catch(() => undefined);
    }

    if (answer.ok) {
      const payoutLine =
        answer.payoutsEnabled === true
          ? "Payouts are enabled."
          : answer.payoutsEnabled === false
            ? "Payouts are not enabled yet, so money will collect in your Stripe balance until they are. You can still take payments."
            : "Stripe did not say whether payouts are enabled.";
      sections.unshift(
        brandCard("Connected and able to take payments", `${escapeHtml(payoutLine)}`),
        postButton(`${PAGE}/disconnect`, "Disconnect this account")
      );
      return res.status(200).type("html").send(shell(sections));
    }

    if (answer.code === "not_connected") {
      sections.unshift(
        brandCard("No payment account connected", "Connecting takes you to Stripe to confirm who you are and where your money should land. You can stop part-way and come back."),
        postButton(`${PAGE}/connect`, "Connect a payment account")
      );
      return res.status(200).type("html").send(shell(sections));
    }

    if (answer.code === "charges_disabled") {
      const due = Array.isArray(answer.requirementsDue) && answer.requirementsDue.length
        // Stripe's own requirement names, shown rather than summarised as
        // "incomplete": "upload a document" and "confirm your bank account" are
        // different afternoons, and only Stripe knows which one this is.
        ? `Stripe still needs: ${escapeHtml(answer.requirementsDue.join(", "))}.`
        : "Stripe has not said what is outstanding.";
      sections.unshift(
        brandCard("Connected, not finished", `${escapeHtml(answer.detail)} ${due}`),
        postButton(`${PAGE}/connect`, "Continue with Stripe")
      );
      return res.status(200).type("html").send(shell(sections));
    }

    // Everything else: we could not tell. Said as not knowing rather than as a
    // negative answer, because "you cannot take payments" and "we could not
    // check" send a business owner to completely different places.
    //
    // Where there is a remembered answer, it is added -- with its date, because
    // a cached flag with nothing saying how old it is asks somebody to trust a
    // number they cannot date. It is never presented as the current state, and
    // the heading still says the check did not happen.
    const remembered = await payments.readAccount(mod, organizationId).catch(() => ({ ok: false }));
    const cached = remembered.ok && remembered.account?.state_checked_at ? remembered.account : null;
    sections.unshift(brandCard("Could not check", `${escapeHtml(explain(answer.code))}${cached ? ` ${escapeHtml(lastKnown(cached))}` : ""}`));
    return res.status(200).type("html").send(shell(sections));
  });

  app.post(`${PAGE}/connect`, requireCustomer, async (req, res) => {
    const mod = moduleDeps();
    if (!mod) return res.redirect(303, `${PAGE}?notice=not_configured`);

    const organizationId = await organizationFor(req);
    if (!organizationId) return res.redirect(303, `${PAGE}?notice=no_organization`);

    const stored = await payments.readAccount(mod, organizationId);
    if (!stored.ok) return res.redirect(303, `${PAGE}?notice=account_unreadable`);

    let accountId = stored.account?.stripe_account_id || null;
    if (!accountId) {
      const created = await payments.createAccount(mod, {
        organizationId,
        email: req.sonaraUser?.email || null,
        createdBy: req.sonaraUser?.id || null
      });
      if (!created.ok) {
        if (created.code === "account_created_but_not_recorded") {
          // The one failure where retrying is the wrong move: pressing connect
          // again would ask Stripe for a second account for one business. The
          // page has to say so rather than offering the same button.
          return res
            .status(500)
            .type("html")
            .send(shell([
              brandCard("Connected at Stripe, not recorded here", `${escapeHtml(explain(created.code))} Identifier: ${escapeHtml(created.accountId)}`),
              howMoneyMoves()
            ]));
        }
        return res.redirect(303, `${PAGE}?notice=${encodeURIComponent(created.code)}`);
      }
      accountId = created.accountId;
    }

    const base = baseUrl(req);
    const link = await payments.onboardingLink(mod, {
      accountId,
      returnUrl: `${base}${PAGE}?notice=returned`,
      refreshUrl: `${base}${PAGE}?notice=expired`
    });
    if (!link.ok) return res.redirect(303, `${PAGE}?notice=${encodeURIComponent(link.code)}`);

    // The module already refused any URL not on connect.stripe.com, so this
    // redirect cannot be pointed anywhere else by a Stripe response.
    return res.redirect(303, link.url);
  });

  app.post(`${PAGE}/disconnect`, requireCustomer, async (req, res) => {
    const mod = moduleDeps();
    if (!mod) return res.redirect(303, `${PAGE}?notice=not_configured`);
    const organizationId = await organizationFor(req);
    if (!organizationId) return res.redirect(303, `${PAGE}?notice=no_organization`);
    const done = await payments.disconnect(mod, organizationId);
    return res.redirect(303, `${PAGE}?notice=${done.ok ? "disconnected" : encodeURIComponent(done.code)}`);
  });

  return { PAGE };
};

module.exports.REQUIRED = REQUIRED;
module.exports.PAGE = PAGE;
module.exports.EXPLAIN = EXPLAIN;
