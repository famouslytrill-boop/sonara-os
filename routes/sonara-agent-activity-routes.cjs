"use strict";

// /owner/agent-activity -- what the agents did, and what they stopped at.
//
// lib/sonara-agent-authority.cjs decides whether an action may run.
// lib/sonara-agent-runner.cjs runs it. lib/sonara-agent-action-log.cjs writes
// the outcome to agent_action_logs. None of that was visible to the owner: an
// agent could be refused a refund seven times and the only record was a table
// nothing read.
//
// This is the read side. Three groups, because they are three different
// questions:
//
//   Waiting for you  -- gated, refused, and still undone
//   Ran on its own   -- the self-serve allowlist, so you can check it stayed there
//   Did not finish   -- failed or unimplemented
//
// **There is an approve button now, and it re-runs the action.**
//
// There was not, and the reason was written here: approving has to do two
// things, record the decision and re-run the action, and nothing re-ran
// anything. A button that wrote approval_state = 'approved' and changed nothing
// else would have told an owner their refund was authorised while no refund
// existed.
//
// supabase/migrations/20260813120000_agent_pending_actions.sql holds the action
// and its inputs; lib/sonara-agent-queue.cjs approves and re-runs it through
// the same runner that refused it. What the button cannot do is make something
// exist that does not: approving an action nothing implements says so on the
// row, in the owner's words, rather than reading as done.
//
// The blank state is not "all clear". An organization with no rows has either
// had no agent activity or has agents that never reached the recorder, and
// those read identically from here. It says so rather than showing a tick.

const { TABLE, createActionLogRecorder } = require("../lib/sonara-agent-action-log.cjs");
const { SENSITIVE_CATEGORY_NAMES } = require("../lib/sonara-agent-authority.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");
const {
  TABLE: QUEUE_TABLE,
  shouldQueue,
  pendingRowFor,
  declineUpdate,
  approveAndRun
} = require("../lib/sonara-agent-queue.cjs");
const { buildTenantQuery } = require("../lib/sonara-tenant-data.cjs");
const { isDue, describe: describeSchedule, CADENCES } = require("../lib/sonara-agent-schedule.cjs");

const SCHEDULE_TABLE = "agent_schedules";

// What a customer may put on a schedule.
//
// The self-serve list from lib/sonara-agent-authority.cjs, and nothing else --
// deliberately narrower than "anything the runner accepts". A schedule naming a
// gated action would queue an approval on the owner every single period, which
// turns a safety gate into a nuisance until somebody switches it off. The
// runner still classifies on every run, so this list cannot widen what actually
// executes; it only keeps the owner's queue from being filled on a timer.
//
// Every entry has a handler in registerApprovedHandlers below, and
// tests/agent-schedule-handlers.test.js fails if one does not. Four of these
// five were offered here for weeks with nothing implementing them: a customer
// could pick "Summarise what changed", save it, and get `unimplemented` every
// week for ever. A menu of five where four do nothing is the same defect as a
// check that passes against a stub, wearing a form instead of a test.
//
// "Summarise what changed" is now "Count what is on file", because that is what
// the handler does. Changing the label to fit the work is the honest direction;
// the other one is a label that describes work nobody wrote.
const SCHEDULABLE = Object.freeze([
  { action: "check_data_quality", label: "Check my records for problems" },
  { action: "prepare_report", label: "Prepare a report from my figures" },
  { action: "summarise_records", label: "Count what is on file" },
  { action: "draft_reply", label: "Draft chasers for overdue invoices" },
  { action: "suggest_next_step", label: "Suggest what to do next" }
]);

function clampInt(value, low, high, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < low || parsed > high) return fallback;
  return parsed;
}

function when0(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "at an unrecorded time";
  return parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

const ROW_LIMIT = 200;
const QUEUE_LIMIT = 50;

// What an approved action is allowed to do, once somebody has approved it.
//
// One entry, deliberately. Registering a handler is how a capability becomes
// real, and every one of them is a decision about what an agent may do to a
// business -- so the list grows one reviewed line at a time rather than by a
// generic executor that runs whatever it is handed.
//
// approve_scheduled_content classifies as `unrecognised`, which is the default
// rule working rather than a gap: it is not one of the seven named categories,
// so it goes to the owner. That is the right answer. Publishing what it
// approves is a separate act, still gated, and nothing here does it.
function registerApprovedHandlers(runner, { supabaseHeaders }) {
  // The one job a schedule can actually do today.
  //
  // Without this every scheduled run answered `unimplemented` -- honest, and
  // useless: a schedule that reports "nothing performs this" every week is the
  // button-that-does-nothing problem on a timer. This runs the same record
  // checks the assistant page runs, against the organisation on the schedule.
  //
  // It returns counts and writes no findings of its own. The run is recorded in
  // agent_action_logs and shows on /owner/agent-activity; the findings
  // themselves stay on the page that renders them, because an audit trail that
  // accumulated copies of a customer's records would be a second store with
  // different retention. That limit is real and is stated rather than papered
  // over -- a scheduled check tells an owner *that* something needs attention,
  // and the page tells them what.
  runner.register("check_data_quality", async ({ config, organizationId }) => {
    const { CHECKS, selectFor, runCheck } = require("../lib/sonara-record-checks.cjs");
    let problems = 0;
    let unreadable = 0;
    for (const check of CHECKS) {
      const query = `?select=${selectFor(check)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=200`;
      const response = await fetch(`${config.url}/rest/v1/${check.table}${query}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
      if (!response?.ok) { unreadable += 1; continue; }
      const rows = await response.json().catch(() => []);
      const result = runCheck(check, Array.isArray(rows) ? rows : []);
      problems += Number(result?.count || 0);
    }
    // An unreadable table is counted separately and never as "nothing wrong".
    return { checks: CHECKS.length, problems, unreadable };
  });

  runner.register("approve_scheduled_content", async ({ config, organizationId, payload }) => {
    const contentId = String(payload?.content_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(contentId)) {
      throw new TypeError("approve_scheduled_content needs the id of one queued item");
    }
    // organization_id is in the filter, not only in the id. The service key
    // bypasses row level security, so this filter is the whole tenant boundary
    // -- an id from another organisation must match nothing rather than match.
    const path = `/rest/v1/growth_content_queue?id=eq.${encodeURIComponent(contentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`;
    const response = await fetch(`${config.url}${path}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ approval_status: "approved", updated_at: new Date().toISOString() })
    }).catch(() => undefined);
    if (!response?.ok) throw new Error("The scheduled item could not be updated.");
    const rows = await response.json().catch(() => []);
    // PostgREST answers 200 with an empty array when the filter matched nothing,
    // which is what a wrong id or another organisation's id looks like. Treating
    // that as success would report an approval that changed no row.
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("That scheduled item is not in your workspace.");
    return { approved: rows.length };
  });

  // One tenant-scoped read. organization_id is in the filter on every one of
  // them, because the service key bypasses row level security and this filter
  // is the entire tenant boundary.
  //
  // Returns null rather than [] when the read fails, and every caller below
  // tests for null. An unreadable table that came back as an empty list would
  // be counted as a business with no invoices, no leads and nothing overdue --
  // a clean bill of health issued by a broken connection.
  async function readRows(config, organizationId, table, select, extra = "") {
    const query = `?select=${select}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=500${extra}`;
    const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return null;
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows : null;
  }

  // Suggest what to do next.
  //
  // The same twenty-seven checks the assistant page runs, reduced to the one
  // that costs the most. "Costs the most" is the check module's own severity
  // order -- money, then blocked, then tidy -- and not a count, because eleven
  // customers missing a phone number is not more urgent than one invoice that
  // was never sent.
  runner.register("suggest_next_step", async ({ config, organizationId }) => {
    const { CHECKS, SEVERITY_ORDER, selectFor, runCheck } = require("../lib/sonara-record-checks.cjs");
    let best = null;
    let unreadable = 0;
    for (const check of CHECKS) {
      const rows = await readRows(config, organizationId, check.table, selectFor(check));
      if (rows === null) { unreadable += 1; continue; }
      const result = runCheck(check, rows);
      if (result.count === 0) continue;
      const rank = SEVERITY_ORDER.indexOf(result.severity);
      if (!best || rank < best.rank) best = { rank, id: result.id, label: result.label, count: result.count, fixPath: result.fixPath };
    }
    // Nothing found and nothing readable are different answers, and the caller
    // is told which. Reporting "you are all clear" after failing to read
    // twenty-seven tables is the exact failure this codebase keeps finding.
    if (!best) return { suggestion: null, unreadable, checked: CHECKS.length - unreadable };
    return { suggestion: best.id, label: best.label, count: best.count, fixPath: best.fixPath, unreadable, checked: CHECKS.length - unreadable };
  });

  // Prepare a report from the figures.
  //
  // lib/sonara-customer-journey.cjs already knows how to turn rows into a
  // funnel and already refuses to invent a drop rate between two stages the
  // schema does not connect. This runs it on a timer; it adds no arithmetic of
  // its own, deliberately, because a second implementation of a funnel is a
  // second set of numbers to disagree with the first.
  runner.register("prepare_report", async ({ config, organizationId }) => {
    const journey = require("../lib/sonara-customer-journey.cjs");
    const results = [];
    let unreadable = 0;
    for (const stage of journey.STAGES) {
      const rows = await readRows(config, organizationId, stage.table, journey.selectFor(stage));
      if (rows === null) { unreadable += 1; continue; }
      results.push(journey.countStage(stage, rows));
    }
    const funnel = journey.build(results);
    return {
      stages: funnel.stages.length,
      total: funnel.total,
      worst: funnel.worst ? { stage: funnel.worst.label, dropRate: funnel.worst.dropRate } : null,
      unreadable
    };
  });

  // Count what is on file.
  //
  // Row counts, one per table the checks read, taken with PostgREST's exact
  // count and `limit=0` -- so this names no column at all and cannot rot the
  // way a select list can. It is the cheapest honest answer to "is my data
  // actually in there", which is a question an owner asks after an import and
  // which nothing in the product answered.
  runner.register("summarise_records", async ({ config, organizationId }) => {
    const { CHECKS } = require("../lib/sonara-record-checks.cjs");
    const tables = [...new Set(CHECKS.map((check) => check.table))].sort();
    const counts = {};
    let unreadable = 0;
    for (const table of tables) {
      const path = `/rest/v1/${table}?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=0`;
      const response = await fetch(`${config.url}${path}`, {
        headers: { ...supabaseHeaders(config), Prefer: "count=exact" }
      }).catch(() => undefined);
      // The count arrives in Content-Range as `*/n`. A response that carries no
      // range is not a zero -- it is a count this did not get, and it goes in
      // the unreadable tally rather than into the report as an empty table.
      const range = response?.ok ? String(response.headers.get("content-range") || "") : "";
      const total = Number(range.split("/")[1]);
      if (!Number.isFinite(total)) { unreadable += 1; continue; }
      counts[table] = total;
    }
    return { tables: Object.keys(counts).length, rows: Object.values(counts).reduce((sum, n) => sum + n, 0), counts, unreadable };
  });

  // Draft chasers for overdue invoices.
  //
  // Drafting is on the self-serve list and sending is not, and the gap between
  // them is the whole point: lib/sonara-chase-drafts.cjs assembles the letter
  // from the invoice, the customer and the payments already recorded, and
  // nothing here sends anything or marks anything as chased.
  //
  // The drafts themselves are not returned past a count. The runner's result
  // reaches the action log, and lib/sonara-agent-action-log.cjs deliberately
  // stores no payload -- a log that accumulated the text of every chaser would
  // be a second copy of the customer list with different retention. The count
  // tells the owner drafts are waiting; the receivables page shows them.
  runner.register("draft_reply", async ({ config, organizationId }) => {
    const chase = require("../lib/sonara-chase-drafts.cjs");
    const invoices = await readRows(config, organizationId, "customer_invoices", "id,invoice_number,customer_id,due_on,total_cents,status");
    if (invoices === null) throw new Error("The invoice list could not be read, so no chaser was drafted.");
    const customers = await readRows(config, organizationId, "customers", "id,name,email");
    if (customers === null) throw new Error("The customer list could not be read, so there is nobody to address a chaser to.");
    const payments = await readRows(config, organizationId, "customer_invoice_payments", "invoice_id,amount_cents");

    const customersById = new Map(customers.map((row) => [row.id, row]));
    // A missing payments table is not "nothing has been paid". Without it an
    // invoice paid in full would be chased, so this refuses rather than guesses.
    if (payments === null) throw new Error("The payment records could not be read, and chasing an invoice that has already been paid is worse than not chasing at all.");
    const paidByInvoice = new Map();
    for (const payment of payments) {
      const already = paidByInvoice.get(payment.invoice_id) || 0;
      const amount = Number(payment.amount_cents);
      paidByInvoice.set(payment.invoice_id, already + (Number.isFinite(amount) ? amount : 0));
    }

    const { drafts, skipped } = chase.build({ invoices, customersById, paidByInvoice });
    return { drafts: drafts.length, skipped: skipped.length, invoicesRead: invoices.length };
  });
}

const GROUPS = Object.freeze([
  Object.freeze({
    key: "pending",
    heading: "Waiting for you",
    blurb: "An agent proposed this and stopped, because your rules say a person decides it.",
    matches: (row) => row.approval_state === "pending"
  }),
  Object.freeze({
    key: "autonomous",
    heading: "Ran on its own",
    blurb: "These are on the self-serve list: they read, summarise or draft, and change nothing you would have to undo.",
    matches: (row) => row.approval_state === "not_required" && row.result === "completed"
  }),
  Object.freeze({
    key: "incomplete",
    heading: "Did not finish",
    blurb: "Allowed to run, and did not. Either nothing implements it yet or it failed part way.",
    matches: (row) => row.result === "failed" || row.result === "unimplemented"
  })
]);

function humanise(value) {
  return String(value || "").replace(/[_.-]+/g, " ").trim();
}

function when(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "at an unrecorded time";
  return parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function registerSonaraAgentActivityRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  const requireCustomer = deps.requireCustomer;
  const requireBusinessManager = deps.requireBusinessManager;
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;

  // Registering with an undefined middleware produces a route that resolves and
  // then throws at request time, which is worse than a route that is absent.
  if (typeof requireCustomer !== "function") return;
  // The page can render without the queue endpoints; the queue endpoints cannot
  // exist without their own gate. Falling back to the page's weaker one would
  // let any member of an organisation approve on the owner's behalf.
  const canRunQueue = typeof requireBusinessManager === "function";

  // The signed-in person, whichever gate put them there. requireCustomer and
  // requireBusinessManager hang the user off different properties, and reading
  // only the page's one made every queue endpoint answer setup_required behind
  // the manager gate -- a 503 that looks like an unconfigured database and is
  // actually a missing property name.
  function userFrom(req) {
    return req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
  }

  function userIdFrom(req) {
    return userFrom(req)?.id || null;
  }

  async function resolveScope(req) {
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(userFrom(req), { autoBootstrap: false }).catch(() => null)
      : null;
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId };
  }

  function queueRunner({ organizationId, actorUserId }) {
    const runner = createRunner({
      record: createActionLogRecorder({ organizationId, agentKey: "owner_queue", actorUserId, getSupabaseServerConfig })
    });
    registerApprovedHandlers(runner, { supabaseHeaders });
    return runner;
  }

  // Read the waiting queue. A read that fails is reported as unreadable, never
  // as an empty queue -- "nothing is waiting for you" is the single most
  // reassuring way for this page to be wrong.
  async function readQueue({ config, organizationId }) {
    const path = buildTenantQuery(QUEUE_TABLE, {
      organizationId,
      select: "id,created_at,agent_key,action_type,subject,category,reason,state,run_result,run_reason,decided_at",
      order: "created_at.desc",
      limit: QUEUE_LIMIT
    });
    const response = await fetch(`${config.url}${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  }

  // Take one row out of `waiting` and return it, or return null because
  // somebody else already decided it. One conditional update rather than a read
  // and then a write: two approve clicks must run the action once.
  async function claim({ config, organizationId, id, nextState, actorUserId }) {
    const path = `/rest/v1/${QUEUE_TABLE}?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}&state=eq.waiting`;
    const response = await fetch(`${config.url}${path}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ state: nextState, decided_by: actorUserId, decided_at: new Date().toISOString() })
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, row: null };
    const rows = await response.json().catch(() => []);
    return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null };
  }

  // The items an agent can be asked about: scheduled content the business has
  // not approved. Read here rather than guessed at, so the form offers real
  // records and an unreadable table is not rendered as "you have none".
  async function readAwaitingApproval({ config, organizationId }) {
    const path = buildTenantQuery("growth_content_queue", {
      organizationId,
      select: "id,title,channel,approval_status,scheduled_for",
      order: "created_at.desc",
      limit: 25
    });
    const response = await fetch(`${config.url}${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    return { ok: true, rows: list.filter((row) => row?.approval_status !== "approved" && row?.approval_status !== "rejected") };
  }

  async function finish({ config, organizationId, id, update }) {
    const path = `/rest/v1/${QUEUE_TABLE}?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}`;
    const response = await fetch(`${config.url}${path}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(update)
    }).catch(() => undefined);
    return Boolean(response?.ok);
  }

  app.get("/owner/agent-activity", requireCustomer, async (req, res) => {
    const back = linkAction("/dashboard", "Back to your dashboard");

    const page = (heading, body, sections) => res.status(200).type("html").send(layout({
      title: "Agent activity",
      eyebrow: "SONARA One",
      heading,
      body,
      sections,
      actions: [back]
    }));

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(userFrom(req), { autoBootstrap: false }).catch(() => null)
      : null;

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return page(
        "Setup required",
        "Your workspace is not connected yet, so there is no agent activity to show.",
        []
      );
    }

    const path = buildTenantQuery(TABLE, {
      organizationId: org.organizationId,
      select: "created_at,agent_key,tool_key,action,risk_level,approval_state,result,metadata",
      order: "created_at.desc",
      limit: ROW_LIMIT
    });

    const response = await fetch(`${config.url}${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);

    if (!response?.ok) {
      // An unreadable table is not an empty one. Reporting it as "no activity"
      // would be the same failure this codebase keeps finding.
      return page(
        "Agent activity is unavailable",
        "The record of what your agents did could not be read just now, so this page cannot tell you whether anything is waiting. Try again shortly.",
        []
      );
    }

    const rows = await response.json().catch(() => []);
    const all = Array.isArray(rows) ? rows : [];

    const sections = [];
    let shown = 0;

    // The queue first, because it is the only part of this page that is asking
    // the owner for something.
    const queue = await readQueue({ config, organizationId: org.organizationId });
    if (!queue.ok) {
      sections.push(brandCard(
        "Your approval queue could not be read",
        "This page cannot tell you whether anything is waiting for a decision. It is not saying nothing is."
      ));
    } else {
      const waiting = queue.rows.filter((row) => row.state === "waiting");
      const decided = queue.rows.filter((row) => row.state !== "waiting");

      if (waiting.length) {
        const items = waiting.map((row) => {
          const subject = String(row.subject || "").trim();
          const buttons = canRunQueue
            ? `<form method="post" action="/api/agents/queue/approve" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(row.id)}"><button type="submit">Approve and run it</button></form>
               <form method="post" action="/api/agents/queue/decline" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(row.id)}"><button type="submit">Decline</button></form>`
            : `<p class="fine">Deciding this needs an owner or manager account.</p>`;
          return `<li><strong>${escapeHtml(humanise(row.action_type))}</strong> · ${escapeHtml(humanise(row.category))} · ${escapeHtml(when(row.created_at))}
            ${subject ? `<br>${escapeHtml(subject)}` : ""}
            ${row.reason ? `<br>${escapeHtml(String(row.reason))}` : ""}
            <br>${buttons}</li>`;
        }).join("");
        sections.push(`<article class="card sonara-depth" data-sonara-enter>
          <h2>Waiting for your decision (${waiting.length})</h2>
          <p>An agent proposed each of these and stopped, because your rules say a person decides it. Approving re-runs the action; declining closes it and changes nothing.</p>
          <ul>${items}</ul>
        </article>`);
      }

      // Handing the agent a task, from the page rather than only from the API.
      //
      // One action, because one action has a handler. A free-text box taking any
      // action_type would look like the product can do more than it can: every
      // name that is not this one queues and then reports that nothing performs
      // it, which is honest and is not worth building a form for.
      if (canRunQueue) {
        const awaiting = await readAwaitingApproval({ config, organizationId: org.organizationId });
        if (!awaiting.ok) {
          sections.push(brandCard(
            "Give an agent a job",
            "Your scheduled content could not be read just now, so there is nothing to offer here. It is not saying you have none."
          ));
        } else if (!awaiting.rows.length) {
          sections.push(brandCard(
            "Give an agent a job",
            "The one job an agent can do here is check scheduled content and ask you to approve it. Nothing of yours is waiting on approval, so there is nothing to ask about."
          ));
        } else {
          const options = awaiting.rows.map((row) =>
            `<option value="${escapeHtml(row.id)}">${escapeHtml(String(row.title || row.channel || "Untitled item"))}</option>`
          ).join("");
          sections.push(`<article class="card">
            <h2>Give an agent a job</h2>
            <p>Ask an agent to put one of your scheduled items in front of you for approval. It cannot approve it itself — that is the point — so it will come back to the list above for your decision.</p>
            <form method="post" action="/api/agents/queue/propose">
              <input type="hidden" name="action_type" value="approve_scheduled_content">
              <label>Which item<select name="content_id" required>${options}</select></label>
              <button type="submit">Ask for my approval</button>
            </form>
          </article>`);
        }
      }

      if (decided.length) {
        const items = decided.map((row) => `<li><strong>${escapeHtml(humanise(row.action_type))}</strong> · ${escapeHtml(humanise(row.state))} · ${escapeHtml(when(row.decided_at || row.created_at))}${row.run_reason ? `<br>${escapeHtml(String(row.run_reason))}` : ""}</li>`).join("");
        sections.push(`<article class="card">
          <h2>Decisions you have made (${decided.length})</h2>
          <p>What happened after you decided. An action you approved that nothing performs yet says so here rather than reading as done.</p>
          <ul>${items}</ul>
        </article>`);
      }
    }

    for (const group of GROUPS) {
      const matched = all.filter(group.matches);
      if (matched.length === 0) continue;
      shown += matched.length;

      const items = matched.map((row) => {
        const category = humanise(row?.metadata?.category || "");
        const reason = String(row?.metadata?.reason || "").trim();
        const detail = [
          category ? `${category}` : "",
          reason
        ].filter(Boolean).join(" — ");
        return `<li><strong>${escapeHtml(humanise(row.action))}</strong> · ${escapeHtml(humanise(row.agent_key))} · ${escapeHtml(when(row.created_at))}${detail ? `<br>${escapeHtml(detail)}` : ""}</li>`;
      }).join("");

      sections.push(`<article class="card sonara-depth" data-sonara-enter>
        <h2>${escapeHtml(group.heading)} (${matched.length})</h2>
        <p>${escapeHtml(group.blurb)}</p>
        <ul>${items}</ul>
      </article>`);
    }

    // An empty log is a card rather than a whole page of its own.
    //
    // It used to be an early return, which was right while this page only read
    // a log: nothing had happened, so there was nothing to show. It is wrong now
    // that the page is also where an owner decides and where they hand an agent
    // a job -- returning early meant the one screen with something to press had
    // nothing on it, at exactly the moment an owner had never used an agent.
    if (all.length === 0) {
      sections.push(brandCard(
        "Nothing has been written to your agent log",
        `That means either no agent has run for your organisation, or one ran without recording it — this page cannot tell those apart, so it is not claiming everything is fine. What gets recorded here is every agent run, including the ones that stop because your rules say you decide. Those rules cover ${SENSITIVE_CATEGORY_NAMES.map(humanise).join(", ")}.`
      ));
    }

    // Rows that match no group -- an approval_state this page does not know
    // about -- are counted rather than dropped, because a silently shorter list
    // is how a category goes missing after somebody adds one.
    const unclassified = all.length - shown;
    if (unclassified > 0) {
      sections.push(brandCard(
        "Not shown above",
        `${unclassified} of ${all.length} recorded runs do not fit any group on this page. They are in your log and this page does not yet know how to describe them.`
      ));
    }


    if (all.length >= ROW_LIMIT) {
      sections.push(brandCard(
        "Showing the most recent",
        `This page shows the latest ${ROW_LIMIT} runs. Older activity is still in your log.`
      ));
    }

    return page(
      "What your agents did",
      "Every agent run for your organisation, newest first — including the ones that stopped and waited for you.",
      sections
    );
  });

  if (!canRunQueue) return;

  const backToActivity = (res, problem = "") =>
    res.redirect(303, problem ? `/owner/agent-activity?problem=${encodeURIComponent(problem)}` : "/owner/agent-activity");

  const wantsHtml = (req) => String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");

  // Hand an agent a task.
  //
  // It runs if the rules allow it and queues if they do not, and those are the
  // only two outcomes -- there is no path here that runs something the gate
  // refused. Proposing is not doing, and the response says which happened.
  app.post("/api/agents/queue/propose", requireBusinessManager, async (req, res) => {
    const scope = await resolveScope(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });

    const actionType = String(req.body?.action_type || "").trim();
    if (!actionType) return res.status(400).json({ ok: false, code: "missing_required", missing: ["action_type"] });

    let payload = req.body?.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { return res.status(400).json({ ok: false, code: "payload_not_json" }); }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
    // A form cannot post a nested object, so the one field the page's form has
    // is lifted into the payload here. Only the named field, not the whole
    // body: copying every posted key would let a caller put anything into a
    // payload a handler later trusts.
    if (!payload.content_id && req.body?.content_id) payload.content_id = String(req.body.content_id);

    const actorUserId = userIdFrom(req);
    const runner = queueRunner({ organizationId: scope.organizationId, actorUserId });
    const run = await runner.run({
      action: { action_type: actionType, proposed_by: actorUserId },
      approval: null,
      context: { config: scope.config, organizationId: scope.organizationId, payload }
    });

    if (!shouldQueue(run)) {
      return res.status(200).json({ ok: run.status === "completed", queued: false, status: run.status, reason: run.reason });
    }

    const row = pendingRowFor({
      run,
      organizationId: scope.organizationId,
      payload,
      subject: String(req.body?.subject || ""),
      agentKey: "owner_queue",
      // A person proposed this through an authenticated request, so it is named.
      // decideExecution reads it: an action with no proposer whose requester and
      // approver are the same party is refused, and leaving this null to save a
      // line would make a solo owner unable to approve their own proposal.
      proposedBy: actorUserId
    });
    const response = await fetch(`${scope.config.url}/rest/v1/${QUEUE_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    }).catch(() => undefined);
    if (!response?.ok) {
      // The action did not run and was not queued. Saying it is waiting for a
      // decision would put it on a list it is not on.
      return res.status(502).json({ ok: false, queued: false, code: "not_queued", reason: "This stopped for your approval and could not be saved to your queue. Nothing has run." });
    }
    const saved = await response.json().catch(() => []);
    return res.status(200).json({ ok: true, queued: true, id: Array.isArray(saved) && saved[0] ? saved[0].id : null, category: run.classification?.category, reason: run.reason });
  });

  app.post("/api/agents/queue/approve", requireBusinessManager, async (req, res) => {
    const scope = await resolveScope(req);
    if (!scope) {
      return wantsHtml(req) ? backToActivity(res, "setup_required") : res.status(503).json({ ok: false, code: "setup_required" });
    }
    const id = String(req.body?.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return wantsHtml(req) ? backToActivity(res, "unknown_action") : res.status(400).json({ ok: false, code: "unknown_action" });
    }

    const actorUserId = userIdFrom(req);
    const claimed = await claim({ config: scope.config, organizationId: scope.organizationId, id, nextState: "running", actorUserId });
    if (!claimed.ok) {
      return wantsHtml(req) ? backToActivity(res, "not_saved") : res.status(502).json({ ok: false, code: "not_saved" });
    }
    if (!claimed.row) {
      // Already decided, or not this organisation's. Both mean there is nothing
      // here to approve, and neither is a reason to run anything.
      return wantsHtml(req) ? backToActivity(res, "already_decided") : res.status(409).json({ ok: false, code: "already_decided" });
    }

    const runner = queueRunner({ organizationId: scope.organizationId, actorUserId });
    const { run, update } = await approveAndRun({
      pending: claimed.row,
      decidedBy: actorUserId,
      runner,
      context: { config: scope.config, organizationId: scope.organizationId, payload: claimed.row.payload || {} }
    });
    await finish({ config: scope.config, organizationId: scope.organizationId, id, update });

    if (wantsHtml(req)) return backToActivity(res, run.status === "completed" ? "" : run.status);
    return res.status(200).json({ ok: run.status === "completed", status: run.status, state: update.state, reason: update.run_reason });
  });

  // ---- Schedules -------------------------------------------------------
  //
  // A customer's own schedule, not the platform's. Two businesses want their
  // week reviewed on different days, and one global cron running everybody's
  // work at 03:00 UTC would be the platform's schedule wearing the customer's
  // name.
  //
  // The safety property that survives this: a scheduled run goes through the
  // same runner as every other, so a gated action started by a schedule still
  // stops at the owner and lands in the queue. A schedule can begin work. It
  // cannot approve it.

  app.get("/owner/agent-schedule", requireCustomer, async (req, res) => {
    const scope = await resolveScope(req);
    const back = [linkAction("/owner/agent-activity", "What your agents did"), linkAction("/dashboard", "Back to your dashboard")];
    if (!scope) {
      return res.status(200).type("html").send(layout({
        title: "Agent schedule", eyebrow: "SONARA One", heading: "Setup required",
        body: "Your workspace is not connected yet, so there is nothing to schedule.", sections: [], actions: back
      }));
    }

    const path = buildTenantQuery(SCHEDULE_TABLE, {
      organizationId: scope.organizationId,
      select: "id,action_type,label,cadence,hour_of_day,day_of_week,day_of_month,time_zone,enabled,last_run_at,last_run_result",
      order: "created_at.desc",
      limit: 50
    });
    const response = await fetch(`${scope.config.url}${path}`, { headers: supabaseHeaders(scope.config) }).catch(() => undefined);
    const sections = [];

    if (!response?.ok) {
      // An unreadable list is never an empty one.
      sections.push(brandCard("Your schedules could not be read", "This page cannot tell you what is scheduled. It is not saying nothing is."));
    } else {
      const rows = await response.json().catch(() => []);
      const list = Array.isArray(rows) ? rows : [];
      if (list.length) {
        const items = list.map((row) => {
          const when = describeSchedule(row);
          const last = row.last_run_at ? `Last run ${when0(row.last_run_at)}${row.last_run_result ? ` — ${escapeHtml(String(row.last_run_result))}` : ""}` : "Has not run yet";
          const off = row.enabled === false ? " (switched off)" : "";
          return `<li><strong>${escapeHtml(humanise(row.action_type))}</strong>${escapeHtml(off)}<br>${escapeHtml(when)}<br>${last}
            ${row.enabled === false ? "" : `<form method="post" action="/api/agents/schedule/disable" class="sonara-inline-form"><input type="hidden" name="id" value="${escapeHtml(row.id)}"><button type="submit">Switch this off</button></form>`}</li>`;
        }).join("");
        sections.push(`<article class="card sonara-depth" data-sonara-enter><h2>Your schedules (${list.length})</h2>
          <p>What runs on its own, and when. Anything your rules say you decide still stops and waits for you — a schedule starts work, it does not approve it.</p>
          <ul>${items}</ul></article>`);
      } else {
        sections.push(brandCard("Nothing is scheduled yet", "Nothing runs on its own for you at the moment. Add a schedule below and it will."));
      }
    }

    if (canRunQueue) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      sections.push(`<article class="card"><h2>Add a schedule</h2>
        <p>Pick the job, the rhythm and the time where you are. Only jobs that read and report can run on their own; anything else will be put in front of you to approve.</p>
        <form method="post" action="/api/agents/schedule">
          <label>What to run<select name="action_type" required>${SCHEDULABLE.map((entry) => `<option value="${escapeHtml(entry.action)}">${escapeHtml(entry.label)}</option>`).join("")}</select></label>
          <label>How often<select name="cadence">${CADENCES.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label>Hour where you are<input type="number" name="hour_of_day" min="0" max="23" value="9"></label>
          <label>Day of the week, for a weekly one<select name="day_of_week">${days.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`).join("")}</select></label>
          <label>Day of the month, for a monthly one<input type="number" name="day_of_month" min="1" max="28" value="1"></label>
          <label>Your time zone<input type="text" name="time_zone" maxlength="64" value="UTC"></label>
          <button type="submit">Add this schedule</button>
        </form></article>`);
    }

    return res.status(200).type("html").send(layout({
      title: "Agent schedule", eyebrow: "SONARA One", heading: "When your agents run",
      body: "Work that happens on its own, on your clock rather than ours.",
      sections, actions: back
    }));
  });

  app.post("/api/agents/schedule", requireBusinessManager, async (req, res) => {
    const scope = await resolveScope(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const actionType = String(req.body?.action_type || "").trim();
    // An allowlist, not free text. A schedule naming a gated action would queue
    // an approval on the owner every single period, which is a way of turning a
    // safety gate into a nuisance until somebody switches it off.
    if (!SCHEDULABLE.some((entry) => entry.action === actionType)) {
      return wantsHtml(req)
        ? res.redirect(303, "/owner/agent-schedule?problem=not_schedulable")
        : res.status(400).json({ ok: false, code: "not_schedulable", message: "Only jobs that read and report can run on their own." });
    }
    const cadence = CADENCES.includes(String(req.body?.cadence)) ? String(req.body.cadence) : "weekly";
    const row = {
      organization_id: scope.organizationId,
      action_type: actionType,
      label: String(req.body?.label || "").slice(0, 200) || null,
      cadence,
      hour_of_day: clampInt(req.body?.hour_of_day, 0, 23, 9),
      day_of_week: cadence === "weekly" ? clampInt(req.body?.day_of_week, 0, 6, 1) : null,
      day_of_month: cadence === "monthly" ? clampInt(req.body?.day_of_month, 1, 28, 1) : null,
      time_zone: String(req.body?.time_zone || "UTC").slice(0, 64),
      created_by: userIdFrom(req)
    };
    const saved = await fetch(`${scope.config.url}/rest/v1/${SCHEDULE_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    }).catch(() => undefined);
    if (!saved?.ok) {
      return wantsHtml(req) ? res.redirect(303, "/owner/agent-schedule?problem=not_saved") : res.status(502).json({ ok: false, code: "not_saved" });
    }
    return wantsHtml(req) ? res.redirect(303, "/owner/agent-schedule") : res.status(200).json({ ok: true });
  });

  app.post("/api/agents/schedule/disable", requireBusinessManager, async (req, res) => {
    const scope = await resolveScope(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const id = String(req.body?.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return wantsHtml(req) ? res.redirect(303, "/owner/agent-schedule?problem=unknown") : res.status(400).json({ ok: false, code: "unknown_schedule" });
    }
    const path = `/rest/v1/${SCHEDULE_TABLE}?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(scope.organizationId)}`;
    const done = await fetch(`${scope.config.url}${path}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() })
    }).catch(() => undefined);
    if (!done?.ok) {
      return wantsHtml(req) ? res.redirect(303, "/owner/agent-schedule?problem=not_saved") : res.status(502).json({ ok: false, code: "not_saved" });
    }
    return wantsHtml(req) ? res.redirect(303, "/owner/agent-schedule") : res.status(200).json({ ok: true, enabled: false });
  });

  // The tick. Called by a scheduler, not a person.
  //
  // Vercel runs no process between requests, so a schedule needs something to
  // knock on the door; vercel.json names this path. It is guarded by a shared
  // secret rather than a session, because there is no signed-in customer behind
  // a cron -- and it is registered whether or not the secret is set, answering
  // 503 when it is not, so a missing secret reads as "not configured" instead
  // of a 404 that looks like the wrong URL.
  //
  // What it will not do: approve anything. Each due schedule goes through the
  // same runner as a request-driven action, so a gated action is refused and
  // queued for the owner exactly as it would be otherwise. The allowlist above
  // means that should not arise, and the runner is still asked, because a list
  // that is the only thing standing between a timer and a refund is a list
  // somebody will edit.
  app.post("/api/agents/schedule/tick", async (req, res) => {
    const expected = String(process.env.SONARA_SCHEDULE_TICK_SECRET || "");
    if (!expected) return res.status(503).json({ ok: false, code: "setup_required", message: "Scheduled runs are not configured." });
    const offered = String(req.get("x-sonara-schedule-secret") || req.body?.secret || "");
    // Length-independent comparison is not the point here; a mismatch is a
    // mismatch. What matters is that an absent header never matches.
    if (!offered || offered !== expected) return res.status(401).json({ ok: false, code: "unauthorized" });

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    if (!config?.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });

    // Crossing tenants on purpose, and saying so. A scheduler runs every
    // organisation's due work, so this one read is deliberately unscoped -- and
    // buildTenantQuery refuses an unscoped query unless the reason is stated,
    // which is why it is stated rather than hand-built to slip past the guard.
    // Every run below is scoped to the organisation on its own row.
    const listPath = buildTenantQuery(SCHEDULE_TABLE, {
      scope: "global",
      globalReason: "the scheduler runs every organisation's due work; each run is then scoped to the organization_id on its own schedule row",
      // Named rather than `select=*`, and the list is not arbitrary: seven of
      // these are what isDue() in lib/sonara-agent-schedule.cjs reads to decide
      // whether a schedule is due, and five are what the loop below uses to run
      // it. organization_id is the one that matters most -- it is what scopes
      // every run underneath this deliberately unscoped read, and a query that
      // dropped it would run every organisation's work against `undefined`.
      //
      // A column isDue starts reading and nobody adds here does not error: it
      // arrives undefined, wholeNumber() reports it as "not recorded", and the
      // schedule is quietly reported as not due. Nothing fires and nothing
      // says why. tests/the-scheduler-asks-for-every-column-it-reads.test.js
      // derives both column sets from the source and fails if this list stops
      // covering them.
      select: "id,organization_id,action_type,payload,label,cadence,hour_of_day,day_of_week,day_of_month,time_zone,enabled,last_run_at",
      eq: { enabled: true },
      order: "last_run_at.asc.nullsfirst",
      limit: 200
    });
    const listed = await fetch(`${config.url}${listPath}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!listed?.ok) return res.status(502).json({ ok: false, code: "schedules_unreadable" });
    const schedules = await listed.json().catch(() => []);
    if (!Array.isArray(schedules)) return res.status(502).json({ ok: false, code: "schedules_unreadable" });

    const now = new Date();
    const ran = [];
    const skipped = [];

    for (const schedule of schedules) {
      const verdict = isDue(schedule, now);
      if (!verdict.due) { skipped.push({ id: schedule.id, reason: verdict.reason }); continue; }

      const runner = queueRunner({ organizationId: schedule.organization_id, actorUserId: null });
      const run = await runner.run({
        // proposed_by is null: a schedule is not a person, and decideExecution
        // reads that to tell an agent's proposal from somebody's own.
        action: { action_type: schedule.action_type, proposed_by: null },
        approval: null,
        context: { config, organizationId: schedule.organization_id, payload: schedule.payload || {} }
      });

      // A gated action should not reach here, and if one does it is queued for
      // the owner rather than dropped.
      if (shouldQueue(run)) {
        await fetch(`${config.url}/rest/v1/${QUEUE_TABLE}`, {
          method: "POST",
          headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(pendingRowFor({
            run,
            organizationId: schedule.organization_id,
            payload: schedule.payload || {},
            subject: `Started by your schedule: ${schedule.label || schedule.action_type}`,
            agentKey: "schedule",
            proposedBy: null
          }))
        }).catch(() => undefined);
      }

      await fetch(`${config.url}/rest/v1/${SCHEDULE_TABLE}?id=eq.${encodeURIComponent(schedule.id)}`, {
        method: "PATCH",
        headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ last_run_at: now.toISOString(), last_run_result: run.status, updated_at: now.toISOString() })
      }).catch(() => undefined);

      ran.push({ id: schedule.id, action: schedule.action_type, status: run.status });
    }

    return res.status(200).json({ ok: true, checked: schedules.length, ran, skipped: skipped.length });
  });

  app.post("/api/agents/queue/decline", requireBusinessManager, async (req, res) => {
    const scope = await resolveScope(req);
    if (!scope) {
      return wantsHtml(req) ? backToActivity(res, "setup_required") : res.status(503).json({ ok: false, code: "setup_required" });
    }
    const id = String(req.body?.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return wantsHtml(req) ? backToActivity(res, "unknown_action") : res.status(400).json({ ok: false, code: "unknown_action" });
    }
    const actorUserId = userIdFrom(req);
    const claimed = await claim({ config: scope.config, organizationId: scope.organizationId, id, nextState: "declined", actorUserId });
    if (!claimed.ok) {
      return wantsHtml(req) ? backToActivity(res, "not_saved") : res.status(502).json({ ok: false, code: "not_saved" });
    }
    if (!claimed.row) {
      return wantsHtml(req) ? backToActivity(res, "already_decided") : res.status(409).json({ ok: false, code: "already_decided" });
    }
    await finish({ config: scope.config, organizationId: scope.organizationId, id, update: declineUpdate({ decidedBy: actorUserId }) });
    if (wantsHtml(req)) return backToActivity(res);
    return res.status(200).json({ ok: true, state: "declined" });
  });
}

// Exported for tests/agent-schedule-handlers.test.js. The route module is the
// only place that knows both the menu and the handlers, so it is the only place
// that can be checked for them agreeing.
registerSonaraAgentActivityRoutes.SCHEDULABLE = SCHEDULABLE;
registerSonaraAgentActivityRoutes.registerApprovedHandlers = registerApprovedHandlers;

module.exports = registerSonaraAgentActivityRoutes;
