// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  simulateMicrotransaction, reviewNonprofitContribution
} = require("../lib/sonara-business-transaction-review.cjs");

const PAGE = "/business-builder/owner/financial-scenarios";
const dollars = (cents) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD"
}).format(cents / 100);

// Deliberately strict; exponent strings, negatives, fractions of cents and
// blank values are invalid, not silently rounded to a financially false 0.
function dollarsToCents(value) {
  if (typeof value !== "string" || !/^\d{1,9}(?:\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, decimal = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
function wholeNumber(value) {
  return typeof value === "string" && /^\d{1,7}$/.test(value.trim()) ? Number(value) : NaN;
}

function registerFinancialScenarioPages(app, deps = {}) {
  const { requireBusinessManager, getCustomerPrimaryOrganization, layout, escapeHtml, linkAction } = deps;
  if ([requireBusinessManager, getCustomerPrimaryOrganization, layout, escapeHtml, linkAction]
    .some((x) => typeof x !== "function")) throw new TypeError("financial scenario routes require business manager and HTML helpers");

  async function organizationScope(req, res, next) {
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user;
    if (!user?.id) return res.status(403).json({ ok: false, code: "identity_unverified" });
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!org?.ok || !org.organizationId) return res.status(403).json({ ok: false, code: "organization_unverified" });
    return next();
  }

  const microFields = [
    ["price", "Customer charge ($)", "1.00"],
    ["quantity", "Number of hypothetical transactions", "100"],
    ["minimum", "Processor minimum charge ($) — verify with your provider", ""],
    ["fixed_fee", "Processor fixed fee per transaction ($)", ""],
    ["rate_percent", "Processor percentage rate (%)", ""],
    ["delivery_cost", "Variable service/delivery cost per transaction ($)", ""],
    ["risk_reserve", "Risk reserve per transaction ($)", ""]
  ];
  const nonprofitFields = [
    ["contribution", "Proposed contribution/payment ($)", ""],
    ["benefit_value", "Estimated goods or services given in return ($)", ""]
  ];

  function fieldsHtml(fields, values, namePrefix) {
    return fields.map(([key, label, sample]) => {
      const value = values[key] ?? sample;
      return '<label style="display:block;margin:0.7rem 0">' + escapeHtml(label) +
        '<input style="display:block;max-width:26rem;width:100%" name="' +
        escapeHtml(key) + '" type="number" inputmode="decimal" min="0" step="' +
        (key === "quantity" ? "1" : "0.01") + '" value="' +
        escapeHtml(String(value)) + '" required autocomplete="off"></label>';
    }).join("");
  }
  function form(kind, title, fields, values = {}) {
    return '<form action="' + PAGE + '" method="post"><fieldset><legend>' +
      escapeHtml(title) + '</legend><input name="kind" type="hidden" value="' +
      kind + '">' + fieldsHtml(fields, values, kind) +
      (kind === "nonprofit" ? '<label><input type="checkbox" name="restricted" value="yes"' +
        (values.restricted === "yes" ? ' checked' : "") + '> Funds have a restricted purpose</label>' : "") +
      '</fieldset><button type="submit">Review draft scenario</button></form>';
  }
  function outputCard(result) {
    if (!result) return "";
    if (!result.ok) {
      return '<section role="alert"><h2>Check these inputs</h2><ul>' +
        result.issues.map((x) => '<li>' + escapeHtml(x.replace(/_/g, " ")) + '</li>').join("") +
        '</ul></section>';
    }
    const entries = result.state === "draft_scenario_only"
      ? [
        ["Processor fee per transaction (estimated)", dollars(result.processorFeePerUnitCents)],
        ["Contribution per transaction (estimated)", dollars(result.contributionPerUnitCents)],
        ["Total estimated contribution", dollars(result.aggregateContributionCents)],
        ["Within supplied minimum amount", result.minimumMetUnderAssumptions ? "Yes" : "No"]
      ] : [
        ["Proposed payment", dollars(result.amountCents)],
        ["Owner-estimated benefit value", dollars(result.estimatedBenefitValueCents)],
        ["$250+ acknowledgment threshold", result.thresholds.donorAcknowledgmentForAtLeast250USD ? "Reached" : "Not reached"],
        [">$75 quid-pro-quo disclosure threshold", result.thresholds.organizationQuidProQuoDisclosureForOver75USD ? "Reached" : "Not reached"]
      ];
    const flags = result.reviewIssues || [];
    return '<section role="status"><h2>Scenario — not an authorization</h2><dl>' +
      entries.map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd>' +
        escapeHtml(value) + '</dd>').join("") + '</dl><p>Review required:</p><ul>' +
      flags.map((flag) => '<li>' + escapeHtml(flag.replace(/_/g, " ")) + '</li>').join("") +
      '</ul><p>No money was transferred, no receipt was issued and no provider terms were verified.</p></section>';
  }

  function render(res, values = {}, kind = null, result = null, status = 200) {
    res.set("Cache-Control", "private, no-store");
    const help = '<p>These are hypothetical calculations. Processing fees depend on your own processor, account, payment method and settlement currency. Nonprofit eligibility, donor disclosures and restricted funds require independent review.</p>';
    return res.status(status).type("html").send(layout({
      title: "Business financial planning tools",
      eyebrow: "Business Builder",
      heading: "Estimate transaction costs and donation disclosures",
      body: "Compare assumptions before pricing small transactions or preparing nonprofit records. This page cannot charge customers, issue charitable receipts or trade securities.",
      sections: [
        help,
        form("micro", "Small-payment economics", microFields, kind === "micro" ? values : {}),
        form("nonprofit", "Nonprofit contribution review", nonprofitFields, kind === "nonprofit" ? values : {}),
        outputCard(result)
      ],
      actions: [
        linkAction("/business-builder/owner/catering", "Catering calculator"),
        linkAction("/business-builder/owner/operations", "Back to operations")
      ]
    }));
  }

  app.get(PAGE, requireBusinessManager, organizationScope, (req, res) => render(res));
  app.post(PAGE, requireBusinessManager, organizationScope, (req, res) => {
    const data = req.body || {};
    let result;
    if (data.kind === "micro") {
      result = simulateMicrotransaction({
        currency: "USD", priceCents: dollarsToCents(data.price),
        quantity: wholeNumber(data.quantity), providerMinimumCents: dollarsToCents(data.minimum),
        processorFixedFeeCents: dollarsToCents(data.fixed_fee),
        processorRateBasisPoints: dollarsToCents(data.rate_percent),
        deliveryCostPerUnitCents: dollarsToCents(data.delivery_cost),
        riskReservePerUnitCents: dollarsToCents(data.risk_reserve)
      });
    } else if (data.kind === "nonprofit") {
      result = reviewNonprofitContribution({
        currency: "USD", amountCents: dollarsToCents(data.contribution),
        estimatedBenefitValueCents: dollarsToCents(data.benefit_value),
        restrictedPurpose: data.restricted === "yes"
      });
    } else {
      result = { ok: false, issues: ["unsupported_scenario_type"] };
    }
    return render(res, data, data.kind, result, result.ok ? 200 : 422);
  });
}

module.exports = registerFinancialScenarioPages;
