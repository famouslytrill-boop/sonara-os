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

module.exports = function registerSonaraAgentActivityRoutes(app, deps = {}) {
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
};
