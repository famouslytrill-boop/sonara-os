// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The Creator Studio project graph, as pages a creator can actually use.
//
//   GET  /creator-studio/owner/project-graph        briefs, assets, versions, what may publish
//   POST /api/creator/briefs                        open a brief
//   POST /api/creator/briefs/status                 move a brief on
//   POST /api/creator/assets/versions               record a new version of an asset
//   POST /api/creator/assets/versions/disclose      answer the AI-disclosure question
//   POST /api/creator/assets/versions/review        ask for a review
//   POST /api/creator/assets/versions/decide        approve or reject one
//
// Every table this writes was created by
// supabase/migrations/20261002010000_creator_project_graph.sql, and this file is
// the reader that keeps them out of lib/sonara-orphan-tables.cjs. That is not a
// formality: the migration-016 artist-system subtree is unreachable precisely
// because nothing creates a row at its head, and twenty tables in this repository
// are created and never queried. A graph nobody can open is the twenty-first.
//
// The decisions all live in lib/sonara-creator-project-graph.cjs. This file reads,
// writes and renders; it does not decide whether something may be published,
// because a page that asks the question and then renders the button regardless is
// the shape routes/sonara-agent-activity-routes.cjs already shipped once.

const graph = require("../lib/sonara-creator-project-graph.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireWorkspaceAccess", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders"
];

const BRIEF_TABLE = "creator_briefs";
const ASSET_TABLE = "creator_assets";
const VERSION_TABLE = "creator_asset_versions";
const APPROVAL_TABLE = "creator_asset_approvals";

// Read one past each cap, so a truncated page is visible rather than looking like
// a short list. A creator told "you have four briefs" when they have two hundred
// has been given a figure, and the figure is wrong.
const BRIEF_CAP = 100;
const ASSET_CAP = 300;
const VERSION_CAP = 500;
const APPROVAL_CAP = 500;

function registerCreatorProjectGraphRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerCreatorProjectGraphRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireWorkspaceAccess, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;
  const PAGE = "/creator-studio/owner/project-graph";
  const guard = requireWorkspaceAccess("creator_studio");

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    return {
      ok: Boolean(config?.ok && org?.organizationId),
      config,
      organizationId: org?.organizationId || null,
      userId: user?.id || null
    };
  }

  async function rest(config, path, init = {}) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: { ...supabaseHeaders(config), ...(init.headers || {}) }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const body = await response.json().catch(() => null);
    return { ok: Array.isArray(body), rows: Array.isArray(body) ? body : [], status: response.status };
  }

  // One read per table, then assembled in memory. Four scoped reads rather than a
  // PostgREST embed, because `creator_assets.brief_id` is a new column and an
  // embed would tie this page to a relationship name the schema cache has to know
  // about. Four reads that are always correct beat one that depends on a cache.
  async function readGraph(scope) {
    const orgFilter = `organization_id=eq.${enc(scope.organizationId)}`;

    const briefs = await rest(scope.config,
      `${BRIEF_TABLE}?select=id,title,summary,intent,status&${orgFilter}&order=created_at.desc&limit=${BRIEF_CAP + 1}`);
    const assets = await rest(scope.config,
      `${ASSET_TABLE}?select=id,title,brief_id&${orgFilter}&order=created_at.desc&limit=${ASSET_CAP + 1}`);
    const versions = await rest(scope.config,
      `${VERSION_TABLE}?select=id,asset_id,version_number,source,ai_disclosure,provenance,note&${orgFilter}&order=version_number.desc&limit=${VERSION_CAP + 1}`);
    const approvals = await rest(scope.config,
      `${APPROVAL_TABLE}?select=id,asset_version_id,state,note,decided_by,decided_at,created_at&${orgFilter}&order=created_at.asc&limit=${APPROVAL_CAP + 1}`);

    return {
      briefs,
      assets,
      versions,
      approvals,
      truncated: briefs.rows.length > BRIEF_CAP || assets.rows.length > ASSET_CAP
        || versions.rows.length > VERSION_CAP || approvals.rows.length > APPROVAL_CAP
    };
  }

  // The row shapes the pure module expects. Done once, here, so the module never
  // has to know what PostgREST calls a column.
  const toVersion = (row) => ({
    id: row.id,
    assetId: row.asset_id,
    versionNumber: row.version_number,
    source: row.source,
    aiDisclosure: row.ai_disclosure,
    provenance: row.provenance,
    note: row.note
  });
  const toApproval = (row) => ({
    id: row.id,
    versionId: row.asset_version_id,
    state: row.state,
    note: row.note,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at
  });

  function groupBy(rows, key) {
    const out = {};
    for (const row of rows) {
      const id = row[key];
      if (!id) continue;
      (out[id] = out[id] || []).push(row);
    }
    return out;
  }

  // The forms. Written out as literal markup rather than assembled from a spec,
  // because every POST this file registers has to be reachable from this page --
  // tests/form-reachability.test.js fails on an endpoint with no form and no
  // stated reason, and a reason is the wrong answer here. A creator who cannot
  // record a version from the page cannot record one at all.
  //
  // Each `select` and radio offers exactly the values the schema's check
  // constraint allows, read from the pure module rather than retyped, so a page
  // cannot offer a choice the database refuses.
  const option = (value, selected) =>
    `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(value.replace(/_/g, " "))}</option>`;

  const briefForm = () => `
    <form action="/api/creator/briefs" method="post">
      <label for="brief-title">What is this brief for?</label>
      <input id="brief-title" name="title" type="text" maxlength="${graph.TITLE_MAX}" required>
      <label for="brief-summary">Anything the work needs to know (optional)</label>
      <textarea id="brief-summary" name="summary" maxlength="${graph.NOTE_MAX}" rows="3"></textarea>
      <label for="brief-intent">Is this your own work, an adaptation, a commission, or a campaign?</label>
      <select id="brief-intent" name="intent">${graph.BRIEF_INTENTS.map((intent) => option(intent, "original")).join("")}</select>
      <button type="submit">Open this brief</button>
    </form>`;

  const statusForm = (brief) => `
    <form action="/api/creator/briefs/status" method="post">
      <input type="hidden" name="brief_id" value="${escapeHtml(brief.id)}">
      <label for="status-${escapeHtml(brief.id)}">Where has this brief got to?</label>
      <select id="status-${escapeHtml(brief.id)}" name="status">${graph.BRIEF_STATUSES.map((status) => option(status, brief.status)).join("")}</select>
      <button type="submit">Save where it has got to</button>
    </form>`;

  const versionForm = (asset) => `
    <form action="/api/creator/assets/versions" method="post">
      <input type="hidden" name="asset_id" value="${escapeHtml(asset.id)}">
      <label for="source-${escapeHtml(asset.id)}">How was this version made?</label>
      <select id="source-${escapeHtml(asset.id)}" name="source">${graph.VERSION_SOURCES.map((source) => option(source, "uploaded")).join("")}</select>
      <fieldset>
        <legend>Is this disclosed as AI-generated?</legend>
        <label><input type="radio" name="ai_disclosure" value="true"> Yes, disclose it as AI-generated</label>
        <label><input type="radio" name="ai_disclosure" value="false"> No, a person made this</label>
        <label><input type="radio" name="ai_disclosure" value="" checked> I will answer this later</label>
      </fieldset>
      <label for="vnote-${escapeHtml(asset.id)}">A note about this version (optional)</label>
      <input id="vnote-${escapeHtml(asset.id)}" name="note" type="text" maxlength="${graph.NOTE_MAX}">
      <button type="submit">Record this version</button>
    </form>`;

  // Three forms on one version, and they are separate on purpose. Asking for a
  // review, answering the disclosure question, and deciding are three different
  // acts by possibly three different people, and one combined form would let a
  // single press do all three.
  const discloseForm = (version) => `
    <form action="/api/creator/assets/versions/disclose" method="post">
      <input type="hidden" name="version_id" value="${escapeHtml(version.id)}">
      <fieldset>
        <legend>Answer the disclosure question for v${escapeHtml(String(version.versionNumber))}</legend>
        <label><input type="radio" name="ai_disclosure" value="true" required> Disclose it as AI-generated</label>
        <label><input type="radio" name="ai_disclosure" value="false" required> A person made this</label>
      </fieldset>
      <button type="submit">Save this answer</button>
    </form>`;

  const reviewForm = (version) => `
    <form action="/api/creator/assets/versions/review" method="post">
      <input type="hidden" name="version_id" value="${escapeHtml(version.id)}">
      <label for="rnote-${escapeHtml(version.id)}">What should the reviewer look at? (optional)</label>
      <input id="rnote-${escapeHtml(version.id)}" name="note" type="text" maxlength="${graph.NOTE_MAX}">
      <button type="submit">Ask for a review</button>
    </form>`;

  const decideForm = (version) => `
    <form action="/api/creator/assets/versions/decide" method="post">
      <input type="hidden" name="version_id" value="${escapeHtml(version.id)}">
      <label for="decide-${escapeHtml(version.id)}">Your decision on v${escapeHtml(String(version.versionNumber))}</label>
      <select id="decide-${escapeHtml(version.id)}" name="state">
        ${["approved", "rejected", "withdrawn"].map((state) => option(state, "approved")).join("")}
      </select>
      <label for="dnote-${escapeHtml(version.id)}">Why (optional)</label>
      <input id="dnote-${escapeHtml(version.id)}" name="note" type="text" maxlength="${graph.NOTE_MAX}">
      <button type="submit">Record this decision</button>
    </form>`;

  // Which of the two sentences the page shows for a `problem=` or `done=` code.
  // The code arrives in the query string; the sentence is looked up here, so a
  // crafted link cannot put text in this product's voice on a creator's page.
  const DONE_SENTENCES = Object.freeze({
    brief: "Your brief is open.",
    status: "Saved where that brief has got to.",
    version: "That version is recorded.",
    disclosure: "That disclosure answer is saved.",
    review: "A review has been asked for.",
    approved: "That version is approved.",
    rejected: "That version is rejected, and the reason is on the record.",
    withdrawn: "That approval is withdrawn."
  });
  const PROBLEM_SENTENCES = Object.freeze({
    workspace: "We could not reach your workspace, so nothing was changed.",
    save_failed: "That did not save. Nothing has changed, and it is worth trying again.",
    status_unknown: "That is not a status this understands, so nothing was changed.",
    asset_missing: "That piece could not be found in this workspace, so nothing was changed.",
    version_missing: "That version could not be found in this workspace, so nothing was changed."
  });
  const noticeFor = (query) => {
    const done = DONE_SENTENCES[String(query?.done || "")];
    if (done) return done;
    const code = String(query?.problem || "");
    return PROBLEM_SENTENCES[code] || graph.problemSentence(code) || null;
  };

  app.get(PAGE, guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) {
      return res.status(503).type("html").send(layout({
        title: "Your project graph",
        eyebrow: "Creator Studio",
        heading: "Your project graph",
        body: "We could not reach your workspace just now. This is a problem on our side, and it is not telling you that you have no work.",
        sections: [],
        actions: [linkAction("/creator-studio", "Creator Studio")]
      }));
    }

    const read = await readGraph(scope);
    // A failed read renders as a failed read. An empty page here would be a
    // sentence -- it says you have made nothing.
    if (!read.briefs.ok || !read.assets.ok || !read.versions.ok || !read.approvals.ok) {
      return res.status(200).type("html").send(layout({
        title: "Your project graph",
        eyebrow: "Creator Studio",
        heading: "Your project graph",
        body: "We could not read part of your project graph just now. Nothing has changed, and this is not a list of your work -- try again shortly.",
        sections: [],
        actions: [linkAction("/creator-studio", "Creator Studio")]
      }));
    }

    const versionsByAsset = groupBy(read.versions.rows.slice(0, VERSION_CAP).map(toVersion), "assetId");
    const approvalsByVersion = groupBy(read.approvals.rows.slice(0, APPROVAL_CAP).map(toApproval), "versionId");
    const assets = read.assets.rows.slice(0, ASSET_CAP);

    // The note somebody left with their latest decision, when there is one. Read
    // from the same approvals the readiness came from rather than re-fetched, so
    // the state a creator sees and the sentence beside it came from one read.
    //
    // It is rendered because it was selected: `note` was coming back on every
    // approval row and appearing nowhere, which is the shape
    // `pnpm run report:selected-columns` exists to catch. A reviewer who wrote why
    // they refused something wrote it for the creator to read.
    const decisionNote = (approvals) => {
      const withNote = (Array.isArray(approvals) ? approvals : []).filter((approval) => approval.note);
      if (!withNote.length) return "";
      return `<p>The last person to look at it said: ${escapeHtml(withNote[withNote.length - 1].note)}</p>`;
    };

    const sections = [];
    const briefs = read.briefs.rows.slice(0, BRIEF_CAP);

    const notice = noticeFor(req.query);
    if (notice) sections.push(brandCard("What just happened", escapeHtml(notice)));

    for (const brief of briefs) {
      const own = assets.filter((asset) => asset.brief_id === brief.id);
      const assembled = graph.graphForBrief({
        brief,
        assets: own,
        versionsByAsset,
        approvalsByVersion
      });

      // Each piece on this brief gets its own state sentence and its own forms.
      // The forms offered depend on the state: the disclosure form appears when
      // the question is unanswered, the decision form when there is a version to
      // decide on. A page that rendered all of them regardless would be offering
      // a creator a button for work that does not exist.
      const blocks = assembled.ok
        ? assembled.nodes.map((node) => {
          const title = escapeHtml(node.asset.title || "Untitled");
          const latest = node.latest;
          if (node.unreadable) {
            return `<p>${title} -- we could not read its versions just now. That is not the same as having none.</p>`;
          }
          if (!latest) {
            return `<p>${title} -- no version recorded yet.</p>${versionForm(node.asset)}`;
          }
          const readiness = node.readiness;
          const sentence = readiness.ok ? "ready to publish." : readiness.reason;
          const needsDisclosure = readiness.blockers.some((blocker) => blocker.id === "disclosure_not_recorded");
          return [
            `<p>${title} v${escapeHtml(String(latest.versionNumber))}: ${escapeHtml(sentence)}</p>`,
            latest.note ? `<p>Your note on this version: ${escapeHtml(latest.note)}</p>` : "",
            decisionNote(approvalsByVersion[latest.id]),
            needsDisclosure ? discloseForm(latest) : "",
            reviewForm(latest),
            decideForm(latest),
            versionForm(node.asset)
          ].join("");
        })
        : [`<p>${escapeHtml(assembled.reason)}</p>`];

      sections.push(brandCard(
        `${brief.title || "Untitled brief"} (${brief.status})`,
        [
          `<p>This is ${escapeHtml(String(brief.intent || "original").replace(/_/g, " "))} work.</p>`,
          `<p>${escapeHtml(brief.summary || "No summary.")}</p>`,
          ...(blocks.length ? blocks : ["<p>Nothing attached to this brief yet.</p>"]),
          statusForm(brief)
        ].join("")
      ));
    }

    // Assets with no brief are shown rather than hidden. They are every asset that
    // existed before this graph did, and a page that only listed briefed work
    // would tell a creator their library was empty.
    const unbriefed = assets.filter((asset) => !asset.brief_id);
    if (unbriefed.length) {
      sections.push(brandCard(
        `Not attached to a brief (${unbriefed.length})`,
        [
          "<p>These were made before you started using briefs, or outside one. They still version and still need a disclosure before they go out.</p>",
          ...unbriefed.map((asset) => `<p>${escapeHtml(asset.title || "Untitled")}</p>${versionForm(asset)}`)
        ].join("")
      ));
    }

    if (read.truncated) {
      sections.push(brandCard(
        "There is more here than this page shows",
        "This page shows the most recent of each. The rest are still yours and still counted; nothing has been removed."
      ));
    }

    if (!briefs.length) {
      sections.push(brandCard("No briefs yet", "Open a brief to group the work that belongs together, then record a version of each piece as you make it."));
    }

    // Always last, and always present. Opening a brief is the one thing a creator
    // can do here from a standing start, so the form that does it is never
    // conditional on there being something to read.
    sections.push(brandCard("Open a brief", briefForm()));

    return res.status(200).type("html").send(layout({
      title: "Your project graph",
      eyebrow: "Creator Studio",
      heading: "Your project graph",
      body: "Every brief, what is attached to it, and whether the newest version of each piece is cleared to go out.",
      sections,
      actions: [linkAction("/creator-studio", "Creator Studio")]
    }));
  });

  const back = (params) => `${PAGE}?${new URLSearchParams(params).toString()}`;

  app.post("/api/creator/briefs", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));

    const normalized = graph.normalizeBrief(req.body || {});
    // Codes, never sentences, through the URL. A sentence round-tripped through a
    // query string lets a crafted link put plausible text in this product's own
    // voice on a creator's authenticated page.
    if (!normalized.ok) return res.redirect(303, back({ problem: normalized.problems[0] }));

    const written = await fetch(`${scope.config.url}/rest/v1/${BRIEF_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        title: normalized.brief.title,
        summary: normalized.brief.summary,
        intent: normalized.brief.intent,
        status: normalized.brief.status,
        created_by: scope.userId
      })
    }).catch(() => undefined);

    return res.redirect(303, back(written?.ok ? { done: "brief" } : { problem: "save_failed" }));
  });

  app.post("/api/creator/briefs/status", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));
    const id = String(req.body?.brief_id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!id || !graph.BRIEF_STATUSES.includes(status)) return res.redirect(303, back({ problem: "status_unknown" }));

    // Scoped by organization as well as by id, because the service-role key
    // bypasses row level security and an id alone is not an authorization.
    const moved = await fetch(
      `${scope.config.url}/rest/v1/${BRIEF_TABLE}?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}`,
      {
        method: "PATCH",
        headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      }
    ).catch(() => undefined);

    return res.redirect(303, back(moved?.ok ? { done: "status" } : { problem: "save_failed" }));
  });

  app.post("/api/creator/assets/versions", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));

    const assetId = String(req.body?.asset_id || "").trim();
    const source = String(req.body?.source || "uploaded").trim().toLowerCase();
    if (!assetId) return res.redirect(303, back({ problem: "asset_missing" }));
    if (!graph.VERSION_SOURCES.includes(source)) return res.redirect(303, back({ problem: "source_unknown" }));

    // The asset must be this organization's. Checked rather than assumed, for the
    // same reason the PATCH above carries the organization filter.
    const owned = await rest(scope.config,
      `${ASSET_TABLE}?select=id&id=eq.${enc(assetId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "asset_missing" }));

    const existing = await rest(scope.config,
      `${VERSION_TABLE}?select=version_number&asset_id=eq.${enc(assetId)}&organization_id=eq.${enc(scope.organizationId)}&order=version_number.desc&limit=${VERSION_CAP}`);
    if (!existing.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const next = graph.nextVersionNumber(existing.rows.map((row) => ({ versionNumber: row.version_number })));
    if (!next.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const disclosureGiven = req.body?.ai_disclosure;
    const written = await fetch(`${scope.config.url}/rest/v1/${VERSION_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        asset_id: assetId,
        version_number: next.next,
        source,
        // Three states preserved all the way to the column. An absent answer is
        // written as null, never defaulted to false.
        ai_disclosure: disclosureGiven === "true" ? true : disclosureGiven === "false" ? false : null,
        note: String(req.body?.note || "").trim().slice(0, graph.NOTE_MAX) || null,
        created_by: scope.userId
      })
    }).catch(() => undefined);

    return res.redirect(303, back(written?.ok ? { done: "version" } : { problem: "save_failed" }));
  });

  app.post("/api/creator/assets/versions/disclose", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));
    const versionId = String(req.body?.version_id || "").trim();
    const answer = String(req.body?.ai_disclosure || "").trim();
    if (!versionId || !["true", "false"].includes(answer)) return res.redirect(303, back({ problem: "version_missing" }));

    const patched = await fetch(
      `${scope.config.url}/rest/v1/${VERSION_TABLE}?id=eq.${enc(versionId)}&organization_id=eq.${enc(scope.organizationId)}`,
      {
        method: "PATCH",
        headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ai_disclosure: answer === "true", updated_at: new Date().toISOString() })
      }
    ).catch(() => undefined);

    return res.redirect(303, back(patched?.ok ? { done: "disclosure" } : { problem: "save_failed" }));
  });

  app.post("/api/creator/assets/versions/review", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));
    const versionId = String(req.body?.version_id || "").trim();
    if (!versionId) return res.redirect(303, back({ problem: "version_missing" }));

    const owned = await rest(scope.config,
      `${VERSION_TABLE}?select=id&id=eq.${enc(versionId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "version_missing" }));

    const written = await fetch(`${scope.config.url}/rest/v1/${APPROVAL_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        asset_version_id: versionId,
        state: "review_requested",
        note: String(req.body?.note || "").trim().slice(0, graph.NOTE_MAX) || null,
        requested_by: scope.userId
      })
    }).catch(() => undefined);

    return res.redirect(303, back(written?.ok ? { done: "review" } : { problem: "save_failed" }));
  });

  app.post("/api/creator/assets/versions/decide", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "workspace" }));
    const versionId = String(req.body?.version_id || "").trim();
    const state = String(req.body?.state || "").trim().toLowerCase();
    if (!versionId || !["approved", "rejected", "withdrawn"].includes(state)) {
      return res.redirect(303, back({ problem: "version_missing" }));
    }

    // A decision is a new row, not an edit of the request. The history of who
    // asked and who answered is the point of an approval record; overwriting the
    // request would leave only the answer.
    const owned = await rest(scope.config,
      `${VERSION_TABLE}?select=id&id=eq.${enc(versionId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "version_missing" }));

    const written = await fetch(`${scope.config.url}/rest/v1/${APPROVAL_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: scope.organizationId,
        asset_version_id: versionId,
        state,
        note: String(req.body?.note || "").trim().slice(0, graph.NOTE_MAX) || null,
        decided_by: scope.userId,
        decided_at: new Date().toISOString()
      })
    }).catch(() => undefined);

    return res.redirect(303, back(written?.ok ? { done: state } : { problem: "save_failed" }));
  });
}

module.exports = registerCreatorProjectGraphRoutes;
