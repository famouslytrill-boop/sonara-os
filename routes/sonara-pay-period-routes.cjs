// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Paying people for the hours they clocked.
//
// `employee_time_entries` has had a clock-in and a clock-out since migration 019,
// and `/api/business/time-entries/start` and `/stop` have been writing to it.
// Nothing read the other end. `employee_wage_rates`, `employee_pay_periods` and
// `employee_pay_statements` existed the whole time with **no reader at all** --
// no route, no library -- because they keyed on `employee_profiles` while the
// time entries keyed on `business_employee_profiles`. See
// supabase/migrations/20261001120000_payroll_keys_on_the_employee_table_with_a_product.sql.
//
// These are the pages. The arithmetic is in lib/sonara-pay-period-engine.cjs and
// is deterministic: no model call, no provider, nothing metered.
//
// There is deliberately NO shift page here. `employee_shifts` is a duplicate of
// `employee_schedules` -- the same columns, a different status vocabulary, and a
// parent with no product -- and `employee_schedules` already has both a writer at
// /business-builder/owner/schedules and a reader in
// routes/sonara-rota-routes.cjs. A second shift surface is the thing not to
// build; lib/sonara-orphan-tables.cjs records the duplicate.
//
// ## Every statement here is a draft
//
// Writing a pay statement is not paying anybody. These routes draft rows at
// `status: "draft"` and never set `paid`, and the page says so. Moving money is
// not something this product does, and an owner reading "paid" on a screen that
// had not paid anybody would be the worst signal in the application.
//
// ## Why the filters are repeated
//
// scripts/report-tenant-scoped-queries.mjs resolves the table and the query from
// the call site and follows neither through a variable. A tenant-scoped table
// with a filter it cannot see is the one combination it refuses outright, and it
// is right to: that is how a cross-tenant write hides. So each statement below
// spells its own table and its own organization filter.

const engine = require("../lib/sonara-pay-period-engine.cjs");

const PAY_PERIODS_PATH = "/business-builder/owner/pay-periods";

// `employee_pay_periods.status`, same constraint, same reason. `paid` is absent
// on purpose: nothing in this product moves money, so nothing here may mark a
// period as having moved it.
const PERIOD_STATUSES = Object.freeze(["open", "review", "approved"]);

module.exports = function registerPayPeriodRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || escapeHtml;
  const requireBusinessManager = typeof deps.requireBusinessManager === "function"
    ? deps.requireBusinessManager
    : failClosed;
  const getConfig = typeof deps.getSupabaseServerConfig === "function"
    ? deps.getSupabaseServerConfig
    : () => ({ ok: false });
  const ui = { layout, card: brandCard, link: linkAction, escape };

  async function scope(req) {
    const config = getConfig();
    if (!config.ok) return { ok: false, message: "Your account database is not connected yet, so there is nothing to show." };
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    if (typeof deps.getCustomerPrimaryOrganization !== "function") {
      return { ok: false, message: "We could not tell which business you are signed in to." };
    }
    const organization = await deps.getCustomerPrimaryOrganization(user);
    if (!organization?.ok) {
      return { ok: false, message: "We could not tell which business you are signed in to. Sign in again and this will fill up." };
    }
    return { ok: true, config, organizationId: organization.organizationId };
  }

  // ---------------------------------------------------------------------------
  // Pay periods
  // ---------------------------------------------------------------------------

  app.get(PAY_PERIODS_PATH, requireBusinessManager, async (req, res) => {
    const where = await scope(req);
    if (!where.ok) {
      return res.status(200).type("html").send(page(ui, "Pay periods", [ui.card("Not available right now", where.message)], PAY_PERIODS_PATH));
    }

    const periods = await rest(
      where.config,
      "employee_pay_periods",
      `select=id,period_start,period_end,pay_date,status&organization_id=eq.${enc(where.organizationId)}&order=period_start.desc&limit=100`
    );

    const sections = [];
    if (!periods.ok) {
      // A read that failed is not an empty list. Telling an owner they have no
      // pay periods on the strength of a request that did not happen is how
      // somebody concludes their payroll history is gone.
      sections.push(ui.card(
        "We could not read your pay periods",
        "The database did not answer just now. Nothing has changed and nothing has been lost. Try again shortly."
      ));
    } else if (!periods.rows.length) {
      sections.push(ui.card(
        "No pay periods yet",
        "A pay period is a start and end date. Once you add one, the hours your people clocked inside it become a draft statement each."
      ));
    } else {
      sections.push(ui.card("Your pay periods", `${periods.rows.length} recorded, newest first.`));
      sections.push(periodTable(ui, periods.rows));
    }

    sections.push(createPeriodForm());
    sections.push(ui.card(
      "What a draft statement is",
      "A total, worked out from the hours already clocked and the rate in force on each day. Drafting one does not pay anybody and does not send anything: this product does not move money."
    ));

    return res.status(200).type("html").send(page(ui, "Pay periods", sections, PAY_PERIODS_PATH, problemFrom(req)));
  });

  app.post(PAY_PERIODS_PATH, requireBusinessManager, async (req, res) => {
    const answer = answerer(req, res, PAY_PERIODS_PATH);
    const where = await scope(req);
    if (!where.ok) return answer(503, { ok: false, code: "setup_required", message: where.message });

    const start = isoDate(req.body?.periodStart);
    const end = isoDate(req.body?.periodEnd);
    const payDate = req.body?.payDate ? isoDate(req.body.payDate) : "";
    if (!start || !end) return answer(400, { ok: false, code: "dates_required", message: "A pay period needs a start date and an end date." });
    if (end < start) return answer(400, { ok: false, code: "end_before_start", message: "The end date is before the start date." });
    if (req.body?.payDate && !payDate) return answer(400, { ok: false, code: "bad_pay_date", message: "That pay date could not be read." });

    const created = await rest(where.config, "employee_pay_periods", "", {
      method: "POST",
      prefer: "return=representation",
      body: {
        organization_id: where.organizationId,
        period_start: start,
        period_end: end,
        pay_date: payDate || null,
        status: "open"
      }
    });

    if (!created.ok) {
      // The table has a unique(organization_id, period_start, period_end), so a
      // duplicate is the likely refusal and worth naming rather than reporting
      // as a database failure.
      const duplicate = created.status === 409;
      return answer(duplicate ? 409 : 502, {
        ok: false,
        code: duplicate ? "period_already_exists" : "not_saved",
        message: duplicate
          ? "You already have a pay period with those exact dates."
          : "The database did not accept that pay period. Nothing has changed."
      });
    }

    return answer(200, { ok: true, periodId: created.rows[0]?.id || null, message: "Pay period added." });
  });

  app.get(`${PAY_PERIODS_PATH}/:periodId`, requireBusinessManager, async (req, res) => {
    const where = await scope(req);
    if (!where.ok) {
      return res.status(200).type("html").send(page(ui, "Pay period", [ui.card("Not available right now", where.message)], PAY_PERIODS_PATH));
    }
    const periodId = String(req.params.periodId || "");
    if (!isUuid(periodId)) {
      return res.status(404).type("html").send(page(ui, "Pay period", [ui.card("Not found", "That pay period was not recognised.")], PAY_PERIODS_PATH));
    }

    const periods = await rest(
      where.config,
      "employee_pay_periods",
      `select=id,period_start,period_end,pay_date,status&id=eq.${enc(periodId)}&organization_id=eq.${enc(where.organizationId)}&limit=1`
    );
    if (!periods.ok) {
      return res.status(200).type("html").send(page(ui, "Pay period", [ui.card("We could not read that pay period", "The database did not answer just now. Nothing has changed.")], PAY_PERIODS_PATH));
    }
    // Filtered on the organization as well as the id, so a period belonging to
    // another business reads as not found rather than as forbidden -- a caller
    // probing ids learns nothing either way.
    if (!periods.rows.length) {
      return res.status(404).type("html").send(page(ui, "Pay period", [ui.card("Not found", "That pay period was not recognised.")], PAY_PERIODS_PATH));
    }

    const period = periods.rows[0];
    const runnable = engine.periodIsRunnable(period);
    const sections = [
      ui.card(`${period.period_start} to ${period.period_end}`, `State: ${escape(String(period.status || "not recorded"))}. Pay date: ${escape(String(period.pay_date || "not set"))}.`)
    ];

    if (!runnable.ok) {
      sections.push(ui.card("Nothing to work out here", runnableMessage(runnable.code)));
      return res.status(200).type("html").send(page(ui, "Pay period", sections, PAY_PERIODS_PATH));
    }

    const run = await computeRun(where, period);
    if (!run.ok && run.code) {
      sections.push(ui.card("We could not work this out", run.message));
      return res.status(200).type("html").send(page(ui, "Pay period", sections, PAY_PERIODS_PATH));
    }

    sections.push(ui.card(
      "Worked out from the hours clocked",
      `${run.result.employees} ${run.result.employees === 1 ? "person" : "people"}, ${run.result.totalHours} hours, ${money(run.result.totalGrossCents)} gross and ${money(run.result.totalNetCents)} net. Nothing here has been paid or sent.`
    ));
    sections.push(statementTable(ui, run.result.statements, run.names));

    if (run.result.problems.length) {
      // Named, not hidden behind a total. A figure with entries silently dropped
      // out of it is the thing this whole repository is about.
      sections.push(ui.card(
        `${run.result.problems.length} ${run.result.problems.length === 1 ? "thing needs" : "things need"} you`,
        run.result.problems.map((problem) => `${run.names.get(problem.businessEmployeeId) || "Someone"}: ${problemMessage(problem)}`).join(" ")
      ));
    }

    sections.push(draftForm(period.id, run.result.statements.length));
    return res.status(200).type("html").send(page(ui, "Pay period", sections, PAY_PERIODS_PATH, problemFrom(req)));
  });

  app.post(`${PAY_PERIODS_PATH}/:periodId/draft-statements`, requireBusinessManager, async (req, res) => {
    const back = `${PAY_PERIODS_PATH}/${encodeURIComponent(String(req.params.periodId || ""))}`;
    const answer = answerer(req, res, back);
    const where = await scope(req);
    if (!where.ok) return answer(503, { ok: false, code: "setup_required", message: where.message });

    const periodId = String(req.params.periodId || "");
    if (!isUuid(periodId)) return answer(404, { ok: false, code: "unknown_period", message: "That pay period was not recognised." });

    const periods = await rest(
      where.config,
      "employee_pay_periods",
      `select=id,period_start,period_end,status&id=eq.${enc(periodId)}&organization_id=eq.${enc(where.organizationId)}&limit=1`
    );
    if (!periods.ok) return answer(502, { ok: false, code: "not_saved", message: "The database did not answer. Nothing has changed." });
    if (!periods.rows.length) return answer(404, { ok: false, code: "unknown_period", message: "That pay period was not recognised." });

    const period = periods.rows[0];
    const runnable = engine.periodIsRunnable(period);
    if (!runnable.ok) return answer(409, { ok: false, code: runnable.code, message: runnableMessage(runnable.code) });

    const run = await computeRun(where, period);
    if (!run.ok && run.code) return answer(502, { ok: false, code: run.code, message: run.message });

    // Only the statements with no problems are written. A statement drafted from
    // hours the engine could not read would be a number an owner might pay.
    const clean = run.result.statements.filter((statement) => statement.ok && statement.countedEntries > 0);
    if (!clean.length) {
      return answer(409, {
        ok: false,
        code: "nothing_to_draft",
        message: "There is nothing to draft yet: no statement in this period is complete. The page lists what each one needs."
      });
    }

    const written = await rest(where.config, "employee_pay_statements", "", {
      method: "POST",
      prefer: "return=representation",
      body: clean.map((statement) => ({
        organization_id: where.organizationId,
        business_employee_id: statement.businessEmployeeId,
        pay_period_id: period.id,
        gross_pay_cents: statement.grossPayCents,
        net_pay_cents: statement.netPayCents,
        currency: statement.currency,
        hours_worked: statement.hoursWorked,
        status: "draft"
      }))
    });

    if (!written.ok) return answer(502, { ok: false, code: "not_saved", message: "The database did not accept those statements. Nothing has changed." });

    const skipped = run.result.statements.length - clean.length;
    return answer(200, {
      ok: true,
      drafted: written.rows.length,
      skipped,
      message: `${written.rows.length} draft ${written.rows.length === 1 ? "statement" : "statements"} saved${skipped ? `, ${skipped} left alone because something is missing` : ""}. Nothing has been paid.`
    });
  });

  // ---------------------------------------------------------------------------

  // Reads the three inputs a pay run needs and hands them to the engine. Each
  // statement spells its own table and its own organization filter, for the
  // reason in this file's header.
  async function computeRun(where, period) {
    const entries = await rest(
      where.config,
      "employee_time_entries",
      `select=id,employee_id,clock_in_at,clock_out_at,break_minutes,status&organization_id=eq.${enc(where.organizationId)}`
        + `&clock_in_at=gte.${enc(`${period.period_start}T00:00:00Z`)}&clock_in_at=lte.${enc(`${period.period_end}T23:59:59Z`)}&limit=2000`
    );
    if (!entries.ok) return { ok: false, code: "entries_unreadable", message: "We could not read the clocked hours for this period. Nothing has changed." };

    const rates = await rest(
      where.config,
      "employee_wage_rates",
      `select=business_employee_id,pay_type,rate_cents,currency,effective_from,effective_to,status&organization_id=eq.${enc(where.organizationId)}&limit=2000`
    );
    if (!rates.ok) return { ok: false, code: "rates_unreadable", message: "We could not read your pay rates. Nothing has changed." };

    const people = await rest(
      where.config,
      "business_employee_profiles",
      `select=id,full_name&organization_id=eq.${enc(where.organizationId)}&limit=500`
    );

    const byEmployee = new Map();
    for (const entry of entries.rows) {
      const key = String(entry.employee_id || "");
      if (!key) continue;
      if (!byEmployee.has(key)) byEmployee.set(key, { entries: [], rates: [] });
      byEmployee.get(key).entries.push(entry);
    }
    for (const rate of rates.rows) {
      const key = String(rate.business_employee_id || "");
      // A rate row with no business_employee_id is one that still only carries
      // the historical employee_id. It is skipped rather than matched by
      // position or by guesswork; the statement then reports no_rate_in_force,
      // which is true and is actionable.
      if (!key || !byEmployee.has(key)) continue;
      byEmployee.get(key).rates.push(rate);
    }

    return {
      ok: true,
      result: engine.payRun({ period, byEmployee }),
      names: new Map(people.ok ? people.rows.map((row) => [row.id, row.full_name]) : [])
    };
  }
};

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

function periodTable(ui, rows) {
  return `<table><caption>Pay periods</caption><thead><tr><th>From</th><th>To</th><th>Pay date</th><th>State</th><th>Open</th></tr></thead><tbody>${
    rows.map((row) => `<tr><td>${ui.escape(row.period_start)}</td><td>${ui.escape(row.period_end)}</td><td>${ui.escape(String(row.pay_date || "Not set"))}</td><td>${ui.escape(String(row.status || "Not recorded"))}</td><td>${ui.link(`${PAY_PERIODS_PATH}/${encodeURIComponent(row.id)}`, "Open")}</td></tr>`).join("")
  }</tbody></table>`;
}

function statementTable(ui, statements, names) {
  return `<table><caption>Worked out for this period</caption><thead><tr><th>Who</th><th>Hours</th><th>Gross</th><th>Net</th><th>Entries used</th></tr></thead><tbody>${
    statements.map((statement) => `<tr><td>${ui.escape(names.get(statement.businessEmployeeId) || "Not recorded")}</td><td>${ui.escape(String(statement.hoursWorked))}</td><td>${ui.escape(money(statement.grossPayCents))}</td><td>${ui.escape(money(statement.netPayCents))}</td><td>${ui.escape(`${statement.countedEntries} of ${statement.payableEntries}`)}</td></tr>`).join("")
  }</tbody></table>`;
}

function createPeriodForm() {
  const options = PERIOD_STATUSES.map((value) => `<option value="${value}">${escapeHtml(value)}</option>`).join("");
  return `<article class="card">
      <h2>Add a pay period</h2>
      <form method="post" action="${PAY_PERIODS_PATH}">
        <label>From<input name="periodStart" type="date" required></label>
        <label>To<input name="periodEnd" type="date" required></label>
        <label>Pay date (optional)<input name="payDate" type="date"></label>
        <button type="submit">Add pay period</button>
      </form>
      <p>New periods start as <code>open</code>. The states a period can be in are ${escapeHtml(PERIOD_STATUSES.join(", "))} — never <code>paid</code>, because this product does not move money.</p>
      <datalist id="pay-period-states">${options}</datalist>
    </article>`;
}

function draftForm(periodId, count) {
  return `<article class="card">
      <h2>Save these as draft statements</h2>
      <form method="post" action="${PAY_PERIODS_PATH}/${escapeHtml(periodId)}/draft-statements">
        <button type="submit">Save ${count} draft ${count === 1 ? "statement" : "statements"}</button>
      </form>
      <p>Saving records the totals. It does not pay anybody, does not send anything, and does not mark the period paid.</p>
    </article>`;
}

function page(ui, heading, sections, current, problem) {
  const body = "Turn the hours your people clocked into a draft statement each. This page does not pay anybody.";
  const all = problem ? [ui.card("That did not save", problem), ...sections] : sections;
  return ui.layout({
    title: heading,
    eyebrow: "Business Builder operations",
    heading,
    body,
    sections: all.length ? all : [ui.card("Not available right now", body)],
    actions: [
      ui.link("/business-builder/owner/schedules", "Shifts and schedules"),
      ui.link("/business-builder/owner/time", "Time clock"),
      ui.link("/business-builder/dashboard", "Business Builder")
    ]
  });
}

function runnableMessage(code) {
  if (code === "period_already_paid") return "This period is marked paid, so nothing more is worked out for it. A second set of statements would pay for the same hours twice.";
  if (code === "period_archived") return "This period is archived.";
  if (code === "period_ends_before_it_starts") return "This period's end date is before its start date, so there is no range to read.";
  if (code === "unreadable_period_dates") return "This period's dates could not be read.";
  return "This period's state is not one this page knows how to work with.";
}

function problemMessage(problem) {
  if (problem.code === "still_clocked_in") return "one entry has no clock-out yet.";
  if (problem.code === "no_rate_in_force") return "no pay rate in force for that day.";
  if (problem.code === "pay_type_needs_the_owner") return `paid by ${String(problem.payType || "another arrangement")}, which is not worked out from hours.`;
  if (problem.code === "clock_out_before_clock_in") return "one entry clocks out before it clocks in.";
  if (problem.code === "break_longer_than_shift") return "one entry's break is longer than the shift.";
  if (problem.code === "negative_break") return "one entry has a negative break.";
  if (problem.code === "unreadable_deduction") return "a deduction amount could not be read.";
  if (problem.code === "unreadable_addition") return "an addition amount could not be read.";
  return "something in the hours could not be read.";
}

function problemFrom(req) {
  const code = String(req.query?.problem || "").trim();
  if (!code) return "";
  if (code === "period_already_exists") return "You already have a pay period with those exact dates.";
  if (code === "dates_required") return "A pay period needs a start date and an end date.";
  if (code === "end_before_start") return "The end date is before the start date.";
  if (code === "nothing_to_draft") return "No statement in this period is complete yet.";
  if (code === "setup_required") return "Your account database is not connected yet.";
  return "Nothing was changed. Try again shortly.";
}

// -----------------------------------------------------------------------------
// Plumbing, matching routes/sonara-sub-app-routes.cjs rather than inventing a
// second shape for the same job.
// -----------------------------------------------------------------------------

function answerer(req, res, back) {
  const html = String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
  return (status, payload) => {
    if (!html) return res.status(status).json(payload);
    if (payload.ok) return res.redirect(303, `${back}?saved=1`);
    return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
  };
}

async function rest(config, relation, query = "", options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${relation}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, rows: Array.isArray(rows) ? rows : [] };
}

// Fails closed, for the reason recorded in
// routes/sonara-subsystem-routes.cjs: a gate read off deps with a fallback that
// called next() was how a write endpoint ended up serving anybody who asked.
function failClosed(req, res) {
  if (String(req.get?.("accept") || "").includes("text/html")) return res.redirect(303, "/business-builder/login");
  return res.status(503).json({ ok: false, code: "setup_required", service: "pay_periods" });
}

function money(cents) {
  const value = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return `${value < 0 ? "-" : ""}$${(Math.abs(value) / 100).toFixed(2)}`;
}
function isoDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : "";
}
function enc(value) { return encodeURIComponent(String(value || "")); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function basicLayout(data) { return `<!doctype html><html><head><title>${escapeHtml(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`; }
function escapeHtml(value) { return String(value === 0 ? 0 : value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }

module.exports.PAY_PERIODS_PATH = PAY_PERIODS_PATH;
module.exports.PERIOD_STATUSES = PERIOD_STATUSES;
