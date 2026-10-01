// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Work that comes round again, and the button that turns the due ones into
// tasks somebody can see.
//
//   GET  /business-builder/owner/recurring-work          what is set up and what is due
//   POST /api/business/recurring-work                    set one up
//   POST /api/business/recurring-work/disable            switch one off
//   POST /api/business/recurring-work/enable             switch one back on
//   POST /api/business/recurring-work/run                issue every occurrence that is due
//
// ## Why running is a button and not a timer
//
// The same answer routes/sonara-recurring-invoice-routes.cjs gives, for the
// same reason: there is a scheduler at POST /api/agents/schedule/tick and its
// menu is restricted to the self-serve actions, the ones that read and report.
// Creating work against somebody's day is a change. The arithmetic in
// lib/sonara-recurring-tasks.cjs does not care who calls it, so putting this on
// a timer later is a registration and not a rewrite.
//
// ## Why the occurrence is an employee_tasks row
//
// Because /staff/tasks already serves that table. A recurring procedure that
// produced rows in a table of its own would need its own staff page, its own
// record checks and its own search entry, and an employee would have two task
// lists to remember. The template is new; the task is the one they already get.
//
// ## What this page will not say
//
// It will not say "you have none" when a read failed. The distinction matters
// more here than on most pages: somebody who is told they have no closing
// checklist when in fact the read broke will set up a second one, and then
// every evening produces two tasks.

const {
  CADENCES, PRIORITIES, isDue, buildTask, describe, normalizeTemplate, problemSentences
} = require("../lib/sonara-recurring-tasks.cjs");

const TABLE = "business_recurring_tasks";
const TASKS_TABLE = "employee_tasks";
const EMPLOYEES_TABLE = "business_employee_profiles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders"
];

// How many templates one page load reads, and how many employees the assignee
// list offers. Both are read one past the cap, which is the only thing that makes
// a cap detectable, and both have a visible consequence rather than silent
// truncation.
//
// The employee cap is the one with teeth. `employeeName` answers "somebody no
// longer on file" for an id it cannot find, and past 500 employees that sentence
// would be printed about people who are still employed -- a definite statement
// about a business's own staff on the strength of a read that was cut short. So
// truncation changes what that fallback says, rather than only adding a notice
// somebody might not connect to the names above it.
const TEMPLATE_CAP = 200;
const EMPLOYEE_CAP = 500;

const CADENCE_LABELS = Object.freeze({
  daily: "Every day",
  weekly: "Every week",
  fortnightly: "Every two weeks",
  monthly: "Every month",
  quarterly: "Every three months",
  yearly: "Every year"
});

function registerRecurringTaskRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerRecurringTaskRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;
  const PAGE = "/business-builder/owner/recurring-work";

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

  // Named rather than select=*, and every column here is read by something
  // below: the first eight are what lib/sonara-recurring-tasks.cjs reads to work
  // out whether a template is due, and the rest are what the page prints or what
  // buildTask puts on the task. A column fetched into a decision and never used
  // is the shape scripts/report-unused-selected-columns.mjs hunts.
  const TEMPLATE_COLUMNS = [
    "id", "cadence", "starts_on", "ends_on", "anchor_day", "enabled", "last_issued_on",
    "title", "description", "priority", "assigned_employee_id", "organization_id"
  ].join(",");

  async function readAll({ config, organizationId }) {
    const scope = `organization_id=eq.${enc(organizationId)}`;
    const [templates, employees] = await Promise.all([
      // One more than the cap, which is what makes the cap detectable at all.
      rest(config, `${TABLE}?${scope}&select=${TEMPLATE_COLUMNS}&order=created_at.desc&limit=${TEMPLATE_CAP + 1}`),
      rest(config, `${EMPLOYEES_TABLE}?${scope}&select=id,display_name,status&order=display_name.asc&limit=${EMPLOYEE_CAP + 1}`)
    ]);
    const truncated = Boolean(templates.ok && templates.rows.length > TEMPLATE_CAP);
    const employeesTruncated = Boolean(employees.ok && employees.rows.length > EMPLOYEE_CAP);
    return {
      templates: truncated ? { ...templates, rows: templates.rows.slice(0, TEMPLATE_CAP) } : templates,
      templatesTruncated: truncated,
      employees: employeesTruncated ? { ...employees, rows: employees.rows.slice(0, EMPLOYEE_CAP) } : employees,
      employeesTruncated
    };
  }

  function employeeName(employees, id, { complete = true } = {}) {
    if (!id) return "nobody in particular";
    const found = employees.find((row) => row.id === id);
    // "No longer on file" is a definite statement, and it is only true when the
    // whole list was read. Past the cap the honest answer is that this page did
    // not look at every employee.
    if (!found) return complete ? "somebody no longer on file" : "a name this page did not read";
    return found.status === "active" ? found.display_name : `${found.display_name} (${found.status})`;
  }

  function setupForm(employees, employeesOk) {
    const cadences = CADENCES
      .map((cadence) => `<option value="${escapeHtml(cadence)}"${cadence === "weekly" ? " selected" : ""}>${escapeHtml(CADENCE_LABELS[cadence])}</option>`)
      .join("");
    const priorities = PRIORITIES
      .map((priority) => `<option value="${escapeHtml(priority)}"${priority === "normal" ? " selected" : ""}>${escapeHtml(priority)}</option>`)
      .join("");
    // An assignee list that could not be read offers nothing rather than an
    // empty dropdown that looks like "this business has no employees".
    const people = employeesOk
      ? `<label>Who does it<select name="assigned_employee_id">
          <option value="">Leave unassigned</option>
          ${employees.filter((row) => row.status === "active").map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.display_name)}</option>`).join("")}
        </select></label>`
      : `<p>We could not read your employee list, so this cannot be assigned to anybody yet. Set it up unassigned and assign it on the task.</p>`;

    return `<form method="post" action="/api/business/recurring-work" class="sonara-stack">
      <label>What happens<input type="text" name="title" maxlength="200" required placeholder="Close the shop"></label>
      <label>Anything the person needs to know<textarea name="description" maxlength="2000" rows="3" placeholder="Count the till, lights off, alarm on."></textarea></label>
      <label>How often<select name="cadence">${cadences}</select></label>
      <label>First time it should happen<input type="date" name="starts_on" required></label>
      <label>Last time it should happen (leave empty for no end)<input type="date" name="ends_on"></label>
      <label>Day of the month, for monthly and longer -- 1 to 31, or the word last<input type="text" name="anchor_day" maxlength="4" placeholder="last"></label>
      <label>How urgent<select name="priority">${priorities}</select></label>
      ${people}
      <button type="submit">Set this up</button>
    </form>`;
  }

  app.get(PAGE, requireBusinessManager, async (req, res) => {
    const back = [
      linkAction("/staff/tasks", "The task list this fills"),
      linkAction("/business-builder/owner/recurring", "Standing invoices"),
      linkAction("/business-builder/dashboard", "Back to your workspace")
    ];
    const scope = await scopeFor(req);
    if (!scope) {
      return res.status(503).type("html").send(layout({
        title: "Work that comes round again",
        eyebrow: "Business Builder",
        heading: "Work that comes round again",
        body: "Your workspace could not be read, so this page cannot say what you have set up.",
        sections: [], actions: back
      }));
    }

    const { templates, templatesTruncated, employees, employeesTruncated } = await readAll(scope);
    const sections = [];
    const now = new Date();

    const done = String(req.query?.done || "");
    const problem = String(req.query?.problem || "");
    if (/^\d+$/.test(done)) {
      sections.push(brandCard(
        `${done} ${done === "1" ? "task" : "tasks"} created`,
        `${done === "1" ? "It is" : "They are"} on the task list now, dated the day ${done === "1" ? "it was" : "they were"} due. Nothing was created twice.`
      ));
    }
    if (problem === "nothing_due") {
      sections.push(brandCard("Nothing was due", "No task was created, because none had come round. Nothing is wrong."));
    }
    if (String(req.query?.unseen || "") === "1") {
      sections.push(brandCard(
        "Not everything was looked at",
        `You have more than ${TEMPLATE_CAP} of these switched on, which is more than one press can work through. `
        + "Both this page and the button read the newest first, so the oldest were not looked at and what was created "
        + "is not necessarily everything that is due. Pressing again reads the same ones, so it will not reach them: "
        + "switch off what you no longer need, and the rest come into view."
      ));
    }
    if (problem === "partial") {
      const refused = String(req.query?.refused || "");
      sections.push(brandCard(
        "Some were not created",
        `${/^\d+$/.test(refused) ? `${refused} did not become a task. ` : "Not everything that was due could be turned into a task. "}`
        + "The reason is written on each one below. Nothing was created twice -- press it again once they are fixed."
      ));
    }
    if (problem === "unrecorded") {
      const unrecorded = String(req.query?.unrecorded || "");
      sections.push(brandCard(
        "Check the task list before pressing this again",
        `${/^\d+$/.test(unrecorded) ? `${unrecorded} task${unrecorded === "1" ? " was" : "s were"}` : "At least one task was"} `
        + "created, but we could not record that it was. Pressing this again would offer the same day and create it a second time. "
        + "Everything else below is unaffected."
      ));
    }
    if (problem === "not_saved") {
      sections.push(brandCard("That did not save", "Nothing was changed. The details you typed were not recorded, so try again."));
    }
    if (problem === "invalid") {
      // The codes come back on the wire; the sentences come from the engine, and
      // problemSentences drops anything it does not recognise. So a crafted link
      // cannot put its own text inside a card on this page -- it can only fail to
      // name a reason, which reads as the generic sentence below.
      const reasons = problemSentences(String(req.query?.why || ""));
      sections.push(brandCard(
        "That could not be set up",
        reasons.length ? reasons.join(" ") : "Some of the details were not usable. Nothing was saved."
      ));
    }

    if (templatesTruncated) {
      sections.push(brandCard(
        "More than this page shows",
        `You have more than ${TEMPLATE_CAP} of these set up, and the newest ${TEMPLATE_CAP} are below. `
        + "The button reads the newest first as well, so the ones not shown here are also not issued -- "
        + "this is not a display limit with everything still running behind it. Switch off what you no longer need."
      ));
    }

    if (!templates.ok) {
      // Never "you have none". That sentence is what makes somebody set up a
      // second copy of a checklist they already have.
      sections.push(brandCard(
        "We could not read your recurring work",
        "This page cannot tell you what is set up or what is due. It is not saying there is nothing, and nothing has stopped running."
      ));
    } else if (!templates.rows.length) {
      sections.push(brandCard(
        "You have not set any up yet",
        "Opening, closing, the weekly clean, the monthly stock count. Describe it once below and it will be on somebody's task list every time it comes round."
      ));
    } else {
      const items = templates.rows.map((template) => {
        const due = isDue(template, { now });
        const who = employeeName(employees.rows, template.assigned_employee_id, { complete: employees.ok && !employeesTruncated });
        const toggle = template.enabled === false
          ? `<form method="post" action="/api/business/recurring-work/enable" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(template.id)}"><button type="submit">Switch this back on</button></form>`
          : `<form method="post" action="/api/business/recurring-work/disable" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(template.id)}"><button type="submit">Switch this off</button></form>`;
        return `<li>
          <strong>${escapeHtml(template.title || "Recurring work")}</strong> · ${escapeHtml(who)}
          <br>${escapeHtml(describe(template))} · ${escapeHtml(String(template.priority || "normal"))}
          <br>${escapeHtml(due.reason)}
          <br>${toggle}
        </li>`;
      }).join("");
      sections.push(htmlCard("What you have set up", `<ul class="sonara-recurring-list">${items}</ul>`));

      const dueNow = templates.rows.filter((template) => isDue(template, { now }).due);
      sections.push(dueNow.length
        ? htmlCard("Ready to issue", `<p>${dueNow.length} ${dueNow.length === 1 ? "thing is" : "things are"} due. Each becomes one task on the task list -- not one per day missed.</p>
          <form method="post" action="/api/business/recurring-work/run"><button type="submit">Create ${dueNow.length} ${dueNow.length === 1 ? "task" : "tasks"}</button></form>`)
        : brandCard("Nothing is due today", "When something is, it will say so here and you can create the task."));
    }

    if (!employees.ok) {
      sections.push(brandCard(
        "We could not read your employee list",
        "Names above read as a name this page did not read, rather than as somebody who has left. Nothing about what is scheduled has changed."
      ));
    } else if (employeesTruncated) {
      sections.push(brandCard(
        "More employees than this page reads",
        `You have more than ${EMPLOYEE_CAP} people on file. The assignee list below offers the first ${EMPLOYEE_CAP} by name, `
        + "and anyone outside that shows above as a name this page did not read rather than as somebody who has left. "
        + "What is scheduled, and who it is assigned to, is unaffected."
      ));
    }

    sections.push(htmlCard("Set up something new", setupForm(employees.rows, employees.ok)));

    return res.status(200).type("html").send(layout({
      title: "Work that comes round again",
      eyebrow: "Business Builder",
      heading: "Work that comes round again",
      body: "Opening, closing, the weekly clean, the monthly count. Described once, on the task list every time it is due.",
      sections, actions: back
    }));
  });

  app.post("/api/business/recurring-work", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });

    // Validation lives in the engine, so the page and any later caller refuse
    // the same things for the same reasons.
    const read = normalizeTemplate(req.body || {});
    if (!read.ok) return res.redirect(303, `${PAGE}?problem=invalid&why=${enc(read.problems.join("."))}`);

    const assigned = read.values.assigned_employee_id;
    if (assigned && !UUID.test(assigned)) {
      return res.redirect(303, `${PAGE}?problem=invalid&why=unknown_employee`);
    }

    const created = await rest(scope.config, `${TABLE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        ...read.values,
        organization_id: scope.organizationId,
        created_by: scope.userId
      })
    });
    if (!created.ok || !created.rows[0]?.id) return res.redirect(303, `${PAGE}?problem=not_saved`);
    return res.redirect(303, PAGE);
  });

  async function setEnabled(req, res, enabled) {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });

    const id = String(req.body?.id || "");
    if (!UUID.test(id)) return res.redirect(303, `${PAGE}?problem=not_saved`);

    // Scoped on the way in as well as by id. The service role bypasses row
    // level security, so this filter is the whole tenant boundary -- an id from
    // a form body is not proof the row belongs to this business.
    const done = await rest(scope.config, `${TABLE}?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ enabled, updated_at: new Date().toISOString() })
    });
    if (!done.ok) return res.redirect(303, `${PAGE}?problem=not_saved`);
    return res.redirect(303, PAGE);
  }

  app.post("/api/business/recurring-work/disable", requireBusinessManager, (req, res) => setEnabled(req, res, false));
  app.post("/api/business/recurring-work/enable", requireBusinessManager, (req, res) => setEnabled(req, res, true));

  app.post("/api/business/recurring-work/run", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });

    // One past the cap here too. Without it a business with more enabled jobs than
    // the cap would have the rest silently not looked at, and the page would report
    // a confident count of what it created -- the cap doing its job right up to the
    // point where it stops being true.
    //
    // The comment is above the call rather than inside the argument list, and that
    // is not a style choice. scripts/report-tenant-scoped-queries.mjs reads the
    // argument after `rest(config,` to work out which table is being queried, and
    // with the comment in that position it read the comment -- so this call joined
    // the reader's blind spot and the recorded count of unresolvable calls went up
    // by one. A comment is not a table name, and putting it where a table name goes
    // is how a query stops being checked.
    const listed = await rest(
      scope.config,
      `${TABLE}?organization_id=eq.${enc(scope.organizationId)}&enabled=is.true&select=${TEMPLATE_COLUMNS}&order=created_at.desc&limit=${TEMPLATE_CAP + 1}`
    );
    // A failed read is not an empty list. Issuing nothing and saying "nothing
    // was due" would tell a business their closing checklist is not due when
    // nobody looked.
    if (!listed.ok) return res.redirect(303, `${PAGE}?problem=not_saved`);
    const unseen = listed.rows.length > TEMPLATE_CAP;
    const considered = unseen ? listed.rows.slice(0, TEMPLATE_CAP) : listed.rows;

    const now = new Date();
    // Three outcomes, not two, and the third is the one that matters.
    //
    // A task written whose template could not be advanced is not the same as a
    // task that was never written: the first one exists on somebody's list and
    // will be offered again, the second does not exist at all. Counting both as
    // "refused" let the page report "0 tasks created" while a task sat on the
    // list -- a figure that is wrong in the direction that makes a business press
    // the button again.
    let created = 0;
    let refused = 0;
    let unrecorded = 0;

    for (const template of considered) {
      const due = isDue(template, { now });
      if (!due.due) continue;

      const built = buildTask({
        template,
        issueOn: due.issueOn,
        organizationId: scope.organizationId,
        createdBy: scope.userId
      });
      if (!built.ok) { refused += 1; continue; }

      const wrote = await rest(scope.config, `${TASKS_TABLE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(built.task)
      });
      if (!wrote.ok) { refused += 1; continue; }
      created += 1;

      // Moved only after the task exists, and this order is the whole of the
      // no-duplicate guarantee. Moving it first would lose an occurrence
      // whenever the task write failed; moving it after means the worst case is
      // the same occurrence offered again, which the business can see.
      const moved = await rest(
        scope.config,
        `${TABLE}?id=eq.${enc(template.id)}&organization_id=eq.${enc(scope.organizationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ last_issued_on: due.issueOn, updated_at: new Date().toISOString() })
        }
      );
      // The task exists and the template does not know it. Reported on its own,
      // because the consequence is specific: pressing again offers the same day,
      // and a second task for that day is the result.
      if (!moved.ok) unrecorded += 1;
    }

    const outcome = new URLSearchParams();
    if (created) outcome.set("done", String(created));
    if (refused) outcome.set("refused", String(refused));
    if (unrecorded) outcome.set("unrecorded", String(unrecorded));
    // One problem code, and the order is by what the business has to act on.
    // An unrecorded task can be duplicated by the next press; a refusal cannot.
    if (unseen) outcome.set("unseen", "1");
    if (unrecorded) outcome.set("problem", "unrecorded");
    else if (refused) outcome.set("problem", "partial");
    else if (unseen) outcome.set("problem", "unseen");
    else if (!created) outcome.set("problem", "nothing_due");
    return res.redirect(303, `${PAGE}?${outcome.toString()}`);
  });
}

module.exports = registerRecurringTaskRoutes;
