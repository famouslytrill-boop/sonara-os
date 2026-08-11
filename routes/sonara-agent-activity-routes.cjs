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
// What this page does not have, and why it does not have it.
//
// There is no approve button. Approving would have to do two things: record the
// approval, and re-run the action. Nothing re-runs actions yet -- the runner is
// called per request by the page that wants work done, and there is no queue
// consuming approvals. A button that wrote approval_state = 'approved' and
// changed nothing else would tell an owner their refund had been authorised
// while no refund existed. The page says what is missing instead of pretending
// to be it.
//
// The blank state is not "all clear". An organization with no rows has either
// had no agent activity or has agents that never reached the recorder, and
// those read identically from here. It says so rather than showing a tick.

const { TABLE } = require("../lib/sonara-agent-action-log.cjs");
const { SENSITIVE_CATEGORY_NAMES } = require("../lib/sonara-agent-authority.cjs");
const { buildTenantQuery } = require("../lib/sonara-tenant-data.cjs");

const ROW_LIMIT = 200;

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
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;

  // Registering with an undefined middleware produces a route that resolves and
  // then throws at request time, which is worse than a route that is absent.
  if (typeof requireCustomer !== "function") return;

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
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
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

    if (all.length === 0) {
      return page(
        "No agent activity recorded",
        "Nothing has been written to your agent log. That means either no agent has run for your organisation, or one ran without recording it — this page cannot tell those apart, so it is not claiming everything is fine.",
        [brandCard(
          "What gets recorded here",
          `Every agent run: the ones that went ahead, and the ones that stopped because your rules require you to decide. The rules cover ${SENSITIVE_CATEGORY_NAMES.map(humanise).join(", ")}.`
        )]
      );
    }

    const sections = [];
    let shown = 0;

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

    sections.push(brandCard(
      "Approving is not wired up yet",
      "Anything waiting for you has to be done on the page that owns it — a refund in your payments, a campaign in Growth Studio. Approving from here would need something that re-runs the action afterwards, and that does not exist, so a button here would tell you a job was done when it was not."
    ));

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
};
