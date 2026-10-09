// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { estimateCatering } = require("../lib/sonara-catering-estimator.cjs");
const { simulateMicrotransaction, reviewNonprofitContribution } = require("../lib/sonara-business-transaction-review.cjs");
const { assessEventResourceScenario } = require("../lib/sonara-event-resource-scenario.cjs");
const PAGE = "/business-builder/owner/catering";
const fields = [
  ["guests", "Guests", "number", "1"],
  ["capacity", "Confirmed venue capacity (blank if unknown)", "number", ""],
  ["menu_name", "Dish or catering package", "text", ""],
  ["portions", "Portions per guest", "number", "1"],
  ["selling_price", "Selling price per portion ($)", "number", ""],
  ["food_cost", "Ingredient cost per portion ($)", "number", ""],
  ["available", "Portions available (blank if unknown)", "number", ""],
  ["staff_cost", "Planned staffing cost ($)", "number", "0"],
  ["equipment_cost", "Equipment and supplies cost ($)", "number", "0"],
  ["travel_cost", "Delivery and logistics cost ($)", "number", "0"],
  ["venue_cost", "Venue cost ($)", "number", "0"],
  ["additional_cost", "Other operating cost ($)", "number", "0"],
  ["service_charge", "Customer service charge ($)", "number", "0"],
  ["tax_amount", "Tax amount after local tax review ($)", "number", "0"],
  ["deposit_percent", "Proposed deposit (%)", "number", "0"]
];
function cents(v) {
  if (typeof v !== "string" || !/^\d{1,9}(?:\.\d{1,2})?$/.test(v.trim())) return NaN;
  const parts = v.trim().split(".");
  return Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
}
function whole(v) { return typeof v === "string" && /^\d{1,8}$/.test(v.trim()) ? Number(v.trim()) : NaN; }
function fromForm(body = {}) {
  return {
    currency: "USD",
    guests: whole(body.guests),
    capacityGuests: body.capacity === "" || body.capacity === undefined ? null : whole(body.capacity),
    menuItems: [{
      name: body.menu_name,
      portionsPerGuest: whole(body.portions),
      pricePerPortionCents: cents(body.selling_price),
      foodCostPerPortionCents: cents(body.food_cost),
      availablePortions: body.available === "" || body.available === undefined ? null : whole(body.available)
    }],
    staffingCostCents: cents(body.staff_cost),
    equipmentCostCents: cents(body.equipment_cost),
    travelCostCents: cents(body.travel_cost),
    venueCostCents: cents(body.venue_cost),
    additionalCostCents: cents(body.additional_cost),
    serviceChargeCents: cents(body.service_charge),
    taxAmountCents: cents(body.tax_amount),
    depositBasisPoints: cents(body.deposit_percent)
  };
}
const dollars = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100);

function registerCateringRoutes(app, deps = {}) {
  const { requireBusinessManager, getCustomerPrimaryOrganization, layout, escapeHtml, linkAction } = deps;
  if ([requireBusinessManager, getCustomerPrimaryOrganization, layout, escapeHtml, linkAction]
    .some((fn) => typeof fn !== "function")) throw new TypeError("catering requires manager authorization, organization access and HTML dependencies");

  async function scope(req, res, next) {
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user;
    if (!user?.id) return res.status(403).json({ ok: false, code: "identity_unverified" });
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!org?.ok || !org.organizationId) return res.status(403).json({ ok: false, code: "organization_unverified" });
    req.cateringOrganizationId = org.organizationId;
    return next();
  }

  function render(res, values = {}, estimate = null, status = 200) {
    const form = '<form method="post" action="' + PAGE + '/estimate"><fieldset><legend>Event and menu</legend>' +
      fields.map(([key, label, type, fallback]) => {
        const current = values[key] ?? fallback;
        const step = ["selling_price", "food_cost", "staff_cost", "equipment_cost", "travel_cost",
          "venue_cost", "additional_cost", "service_charge", "tax_amount", "deposit_percent"].includes(key)
          ? ' step="0.01"' : ' step="1"';
        const required = ["guests", "menu_name", "portions", "selling_price", "food_cost",
          "staff_cost", "equipment_cost", "travel_cost", "venue_cost", "additional_cost",
          "service_charge", "tax_amount", "deposit_percent"].includes(key) ? " required" : "";
        return '<label style="display:block;margin:0.75rem 0">' + escapeHtml(label) +
          '<input style="display:block;max-width:25rem;width:100%" name="' + key +
          '" type="' + type + '" value="' + escapeHtml(String(current)) + '"' +
          (type === "number" ? ' min="0"' + step : "") + required + '></label>';
      }).join("") + '</fieldset><p>Figures are estimates, not tax, food-safety or payment approval.</p>' +
      '<button type="submit">Calculate catering estimate</button></form>';
    const detail = !estimate ? "" : estimate.ok
      ? '<article><h2>Owner review draft</h2><dl>' + [
        ["Estimated customer total", estimate.totals.customerEstimateCents],
        ["Food cost", estimate.totals.foodCostCents],
        ["Planned operating cost", estimate.totals.plannedOperatingCostCents],
        ["Suggested deposit", estimate.totals.suggestedDepositCents],
        ["Balance after deposit", estimate.totals.amountAfterDepositCents],
        ["Contribution before service charge and tax", estimate.totals.contributionBeforeServiceChargeAndTaxCents]
      ].map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(dollars(value)) + '</dd>').join("") +
      '</dl><h3>Checks before confirming</h3><ul>' +
      estimate.issues.map((s) => '<li>' + escapeHtml(s.replace(/_/g, " ")) + '</li>').join("") +
      '</ul><p>Nothing was saved, charged, sent, or reserved.</p></article>'
      : '<article role="alert"><h2>Please correct the estimate</h2><ul>' +
        estimate.issues.map((s) => '<li>' + escapeHtml(s.replace(/_/g, " ")) + '</li>').join("") + '</ul></article>';
    res.set("Cache-Control", "private, no-store");
    return res.status(status).type("html").send(layout({
      title: "Catering and event planning",
      eyebrow: "Business Builder",
      heading: "Plan a catering event",
      body: "Calculate portions, sales, food costs, operating costs and a proposed deposit. No payment or booking occurs.",
      sections: [form, detail],
      actions: [linkAction("/business-builder/owner/menu", "Manage menu"), linkAction("/business-builder/owner/operations", "View operations")]
    }));
  }

  app.get(PAGE, requireBusinessManager, scope, (req, res) => render(res));
  app.post(PAGE + "/estimate", requireBusinessManager, scope, (req, res) => {
    const estimate = estimateCatering(fromForm(req.body));
    return render(res, req.body || {}, estimate, estimate.ok ? 200 : 422);
  });
  // Owner-scoped planning endpoints: they consume supplied scenarios only,
  // read no external provider and never approve checkout or a capacity hold.
  for (const [route, evaluate] of [
    ["/api/business/finance/microtransaction-scenario", simulateMicrotransaction],
    ["/api/business/nonprofits/contribution-review", reviewNonprofitContribution],
    ["/api/business/events/resource-scenario", assessEventResourceScenario]
  ]) {
    app.post(route, requireBusinessManager, scope, (req, res) => {
      res.set("Cache-Control", "private, no-store");
      const result = evaluate(req.body);
      return res.status(result.ok ? 200 : 422).json(result);
    });
  }

  app.post("/api/business/catering/estimate", requireBusinessManager, scope, (req, res) => {
    const estimate = estimateCatering(req.body);
    res.set("Cache-Control", "private, no-store");
    return res.status(estimate.ok ? 200 : 422).json(estimate);
  });
}

module.exports = registerCateringRoutes;
