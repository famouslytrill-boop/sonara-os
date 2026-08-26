"use strict";

// Standing arrangements, and the button that turns the due ones into drafts.
//
//   GET  /business-builder/owner/recurring          what is set up and what is due
//   POST /api/business/recurring                    create one
//   POST /api/business/recurring/disable            switch one off
//   POST /api/business/recurring/run                issue every arrangement that is due
//
// ## Why running is a button and not only a timer
//
// There is a scheduler already -- POST /api/agents/schedule/tick -- and issuing
// invoices is deliberately not on it. The schedule menu is restricted to the
// self-serve actions, which are the ones that read and report; creating an
// invoice against a customer is a change, and a business should be able to see
// what is about to be billed before it is.
//
// The page therefore shows what is due and the owner presses run. The
// arithmetic is the same either way, so putting it on a timer later is a
// registration and not a rewrite.
//
// ## Why the invoice number is left null
//
// customer_invoices.invoice_number is free text and this application has no
// numbering scheme -- there is no sequence, no per-organization counter, and no
// agreed format. Inventing one here would put a number on a customer's invoice
// that disagrees with whatever the business already uses on paper, and a
// duplicate invoice number is an accounting problem rather than a cosmetic one.
// Left null, and the record checks already report an invoice with no number.

const { isDue, buildInvoice, describe: describeSchedule, CADENCES } = require("../lib/sonara-recurring-invoices.cjs");

const TABLE = "recurring_invoices";
const LINES_TABLE = "recurring_invoice_lines";
const INVOICES_TABLE = "customer_invoices";
const INVOICE_LINES_TABLE = "customer_invoice_lines";
const CUSTOMERS_TABLE = "customers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders"
];

function money(cents, currency = "usd") {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return null;
  return `${String(currency).toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

function registerRecurringInvoiceRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerRecurringInvoiceRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;
  const PAGE = "/business-builder/owner/recurring";

  function htmlCard(title, inner) {
    return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2>${inner}</article>`;
  }

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId, userId: user?.id || null };
  }

  async function rest(config, path, init) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: { ...supabaseHeaders(config), ...(init?.headers || {}) }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: response?.status || 0, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, status: response.status, rows: Array.isArray(rows) ? rows : [] };
  }

  async function readAll({ config, organizationId }) {
    const scope = `organization_id=eq.${enc(organizationId)}`;
    const [schedules, lines, customers] = await Promise.all([
      rest(config, `${TABLE}?${scope}&select=id,customer_id,label,enabled,cadence,anchor_day,starts_on,ends_on,payment_terms_days,tax_rate_basis_points,currency,last_issued_on&order=created_at.desc&limit=200`),
      rest(config, `${LINES_TABLE}?${scope}&select=recurring_invoice_id,service_id,description,quantity,unit_price_cents&order=position.asc&limit=1000`),
      rest(config, `${CUSTOMERS_TABLE}?${scope}&select=id,name&order=name.asc&limit=500`)
    ]);
    return { schedules, lines, customers };
  }

  function linesFor(lines, scheduleId) {
    return lines.filter((line) => line.recurring_invoice_id === scheduleId);
  }

  app.get(PAGE, requireBusinessManager, async (req, res) => {
    const back = [linkAction("/business-builder/owner/invoices", "Your invoices"), linkAction("/business-builder/dashboard", "Back to your workspace")];
    const scope = await scopeFor(req);
    if (!scope) {
      return res.status(503).type("html").send(layout({
        title: "Standing arrangements", eyebrow: "Business Builder", heading: "Standing arrangements",
        body: "Your workspace could not be read, so this page cannot say what you have set up.",
        sections: [], actions: back
      }));
    }

    const { schedules, lines, customers } = await readAll(scope);
    const sections = [];

    if (!schedules.ok) {
      // Never "you have none". That sentence invites somebody to set up a
      // second copy of an arrangement they already have.
      sections.push(brandCard("We could not read your arrangements", "This page cannot tell you what is set up or what is due. It is not saying there is nothing."));
    } else if (!schedules.rows.length) {
      sections.push(brandCard("You have no standing arrangements yet", "If you bill somebody the same thing every month, set it up once below and this will have the invoice ready for you."));
    } else {
      const names = new Map(customers.rows.map((row) => [row.id, row.name]));
      const items = schedules.rows.map((schedule) => {
        const due = isDue(schedule, { now: new Date() });
        const own = linesFor(lines.rows, schedule.id);
        const subtotal = own.reduce((sum, line) => sum + Math.round(Number(line.quantity || 0) * Number(line.unit_price_cents || 0)), 0);
        const who = schedule.customer_id ? (names.get(schedule.customer_id) || "a customer no longer on file") : "nobody";
        return `<li>
          <strong>${escapeHtml(schedule.label || "Standing arrangement")}</strong> · ${escapeHtml(who)}
          <br>${escapeHtml(describeSchedule(schedule))} · ${escapeHtml(money(subtotal, schedule.currency) || "no lines")}${lines.ok ? "" : " (lines could not be read)"}
          <br>${escapeHtml(due.reason)}
          ${schedule.enabled === false ? "" : `<br><form method="post" action="/api/business/recurring/disable" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(schedule.id)}"><button type="submit">Switch this off</button></form>`}
        </li>`;
      }).join("");
      sections.push(htmlCard("What you have set up", `<ul class="sonara-recurring-list">${items}</ul>`));

      const dueNow = schedules.rows.filter((schedule) => isDue(schedule, { now: new Date() }).due);
      sections.push(dueNow.length
        ? htmlCard("Ready to issue", `<p>${dueNow.length} ${dueNow.length === 1 ? "arrangement is" : "arrangements are"} due. Each becomes a draft invoice you can check before you send it.</p>
          <form method="post" action="/api/business/recurring/run"><button type="submit">Create ${dueNow.length} draft ${dueNow.length === 1 ? "invoice" : "invoices"}</button></form>`)
        : brandCard("Nothing is due today", "When one is, it will say so here and you can create the draft."));
    }

    if (!lines.ok) sections.push(brandCard("We could not read what is on your arrangements", "The amounts above are missing rather than zero. Do not issue from this page until it loads properly."));

    const customerOptions = customers.ok
      ? customers.rows.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name || "Unnamed")}</option>`).join("")
      : "";

    sections.push(customers.ok && customers.rows.length
      ? htmlCard("Set one up", `
        <form method="post" action="/api/business/recurring" class="sonara-settings-form">
          <label>Customer<select name="customer_id" required>${customerOptions}</select></label>
          <label>What to call it<input type="text" name="label" maxlength="120" placeholder="Monthly retainer"></label>
          <label>How often<select name="cadence">${CADENCES.map((cadence) => `<option value="${cadence}">${cadence}</option>`).join("")}</select></label>
          <label>On which day<input type="text" name="anchor_day" value="1" maxlength="4" pattern="last|[0-9]{1,2}" placeholder="1-31 or last"></label>
          <label>Starting<input type="date" name="starts_on" required></label>
          <label>Ending (leave blank for no end)<input type="date" name="ends_on"></label>
          <label>Payment terms in days<input type="number" name="payment_terms_days" min="0" max="365" placeholder="Leave blank if none agreed"></label>
          <label>Tax rate, as a percentage<input type="number" name="tax_percent" min="0" max="100" step="0.01" value="0"></label>
          <fieldset><legend>What is billed</legend>
            <label>Description<input type="text" name="description" maxlength="200" required></label>
            <label>Quantity<input type="number" name="quantity" step="0.01" min="0" value="1" required></label>
            <label>Price each<input type="number" name="unit_price" step="0.01" min="0" required></label>
          </fieldset>
          <button type="submit">Set it up</button>
        </form>
        <p class="fine">One line to start with. You can add more on the arrangement once it exists.</p>`)
      : brandCard("Add a customer first", customers.ok
        ? "An arrangement bills somebody, so there has to be somebody on file to bill."
        : "Your customer list could not be read, so this cannot offer you anybody to bill."));

    const problem = String(req.query?.problem || "");
    const problems = {
      customer: "Choose a customer. An arrangement has to bill somebody.",
      dates: "The start date has to be a real date, and any end date has to come after it.",
      line: "Give the thing being billed a description, a quantity and a price.",
      not_saved: "We could not save that. Nothing was set up."
    };
    if (problems[problem]) sections.unshift(brandCard("Not saved", problems[problem]));
    const done = String(req.query?.done || "");
    if (/^\d+$/.test(done)) {
      sections.unshift(brandCard(
        `${done} draft ${done === "1" ? "invoice" : "invoices"} created`,
        "They are drafts. Check them and send them from your invoices page -- nothing has gone to a customer."
      ));
    }
    if (problem === "partial") {
      sections.unshift(brandCard(
        "Some were not created",
        "Not every arrangement that was due could be turned into an invoice. The reasons are on each one above. Nothing was billed twice -- run it again once they are fixed."
      ));
    }

    return res.status(200).type("html").send(layout({
      title: "Standing arrangements", eyebrow: "Business Builder", heading: "Standing arrangements",
      body: "The invoices you send every month, ready without typing them again.",
      sections, actions: back
    }));
  });

  app.post("/api/business/recurring", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });

    const customerId = String(req.body?.customer_id || "");
    if (!UUID.test(customerId)) return res.redirect(303, `${PAGE}?problem=customer`);

    const startsOn = String(req.body?.starts_on || "");
    const endsOn = String(req.body?.ends_on || "").trim();
    if (!ISO_DAY.test(startsOn)) return res.redirect(303, `${PAGE}?problem=dates`);
    if (endsOn && (!ISO_DAY.test(endsOn) || endsOn < startsOn)) return res.redirect(303, `${PAGE}?problem=dates`);

    const description = String(req.body?.description || "").trim().slice(0, 200);
    const quantity = Number(req.body?.quantity);
    const unit = Number(req.body?.unit_price);
    if (!description || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unit) || unit < 0) {
      return res.redirect(303, `${PAGE}?problem=line`);
    }

    const cadence = CADENCES.includes(String(req.body?.cadence)) ? String(req.body.cadence) : "monthly";
    const rawAnchor = String(req.body?.anchor_day || "").trim().toLowerCase();
    const anchorDay = rawAnchor === "last"
      ? "last"
      : String(Math.min(31, Math.max(1, Number.parseInt(rawAnchor, 10) || Number(startsOn.slice(8, 10)))));

    const terms = req.body?.payment_terms_days;
    const parsedTerms = String(terms ?? "").trim() === "" ? null : Number.parseInt(String(terms), 10);
    const percent = Number(req.body?.tax_percent);

    const created = await rest(scope.config, `${TABLE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        customer_id: customerId,
        label: String(req.body?.label || "").trim().slice(0, 120) || null,
        cadence,
        anchor_day: anchorDay,
        starts_on: startsOn,
        ends_on: endsOn || null,
        payment_terms_days: Number.isInteger(parsedTerms) && parsedTerms >= 0 && parsedTerms <= 365 ? parsedTerms : null,
        // Percent in, basis points stored. A rate typed as 20 is 20%, and
        // storing it as an integer of hundredths of a percent means the tax on
        // an invoice is never a float that rounds differently on two machines.
        tax_rate_basis_points: Number.isFinite(percent) ? Math.round(Math.min(100, Math.max(0, percent)) * 100) : 0,
        created_by: scope.userId
      })
    });
    if (!created.ok || !created.rows[0]?.id) return res.redirect(303, `${PAGE}?problem=not_saved`);

    const line = await rest(scope.config, `${LINES_TABLE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        recurring_invoice_id: created.rows[0].id,
        description,
        quantity,
        unit_price_cents: Math.round(unit * 100),
        position: 0
      })
    });
    if (!line.ok) {
      // An arrangement with no lines bills nothing, and buildInvoice refuses
      // it -- so the row would sit there looking set up and never produce an
      // invoice. Switched off rather than left in that state.
      await rest(scope.config, `${TABLE}?id=eq.${enc(created.rows[0].id)}&organization_id=eq.${enc(scope.organizationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ enabled: false, notes: "Set up did not finish -- nothing was recorded as being billed." })
      });
      return res.redirect(303, `${PAGE}?problem=not_saved`);
    }

    return res.redirect(303, PAGE);
  });

  app.post("/api/business/recurring/disable", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const id = String(req.body?.id || "");
    if (!UUID.test(id)) return res.redirect(303, `${PAGE}?problem=not_saved`);
    const done = await rest(scope.config, `${TABLE}?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() })
    });
    return res.redirect(303, done.ok ? PAGE : `${PAGE}?problem=not_saved`);
  });

  app.post("/api/business/recurring/run", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });

    const { schedules, lines } = await readAll(scope);
    // Both, not either. Issuing from arrangements whose lines could not be read
    // would bill for nothing, and buildInvoice would refuse each one -- so the
    // owner would press a button and be told every arrangement is broken.
    if (!schedules.ok || !lines.ok) return res.redirect(303, `${PAGE}?problem=not_saved`);

    let created = 0;
    let failed = 0;

    for (const schedule of schedules.rows) {
      const due = isDue(schedule, { now: new Date() });
      if (!due.due) continue;

      const built = buildInvoice({
        schedule,
        issueOn: due.issueOn,
        lines: linesFor(lines.rows, schedule.id),
        invoiceNumber: null
      });
      if (!built.ok) { failed += 1; continue; }

      const invoice = await rest(scope.config, `${INVOICES_TABLE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          ...built.invoice,
          organization_id: scope.organizationId,
          recurring_invoice_id: schedule.id,
          created_by: scope.userId
        })
      });
      // A unique violation here is the index doing its job: another run already
      // issued this arrangement for this date. Counted as neither created nor
      // failed, because nothing is wrong and nothing was billed twice.
      if (!invoice.ok) { if (invoice.status !== 409) failed += 1; continue; }
      const invoiceId = invoice.rows[0]?.id;
      if (!invoiceId) { failed += 1; continue; }

      if (built.lines.length) {
        await rest(scope.config, `${INVOICE_LINES_TABLE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(built.lines.map((line) => ({
            ...line,
            organization_id: scope.organizationId,
            invoice_id: invoiceId
          })))
        });
      }

      // Written after the invoice exists, never before. The other order means a
      // failed insert still moves the arrangement on, and that period is never
      // billed by anybody.
      await rest(scope.config, `${TABLE}?id=eq.${enc(schedule.id)}&organization_id=eq.${enc(scope.organizationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_issued_on: due.issueOn, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      });
      created += 1;
    }

    const query = failed ? `?done=${created}&problem=partial` : `?done=${created}`;
    return res.redirect(303, `${PAGE}${query}`);
  });
}

registerRecurringInvoiceRoutes.TABLE = TABLE;
registerRecurringInvoiceRoutes.LINES_TABLE = LINES_TABLE;

module.exports = registerRecurringInvoiceRoutes;
