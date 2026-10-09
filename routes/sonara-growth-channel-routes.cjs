// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { CATALOG: FREE_SURFACE_CATALOG } = require("../lib/sonara-free-platform-surface-policy.cjs");

// Channels: a public page a business posts to, and a directory to find them by.
//
//   GET  /growth-studio/owner/channels          the business's channels, posts and reports
//   POST /api/growth/channels                   create a channel (a draft)
//   POST /api/growth/channels/publish           make it public and list it
//   POST /api/growth/channels/hide              take it out of the directory and hide it
//   POST /api/growth/channels/posts             post, or announce
//   POST /api/growth/channels/posts/remove      take a post down (a state, not a delete)
//   POST /api/growth/channels/posts/restore     put it back
//   POST /api/growth/channels/reports/dismiss   look at a post's reports and leave it up
//   GET  /channels                              the public directory. No account.
//   GET  /channels/:handle                      a public channel. No account.
//   POST /channels/:handle/report               flag a post. No account, no name.
//   GET  /channels/:handle/feed.xml             the channel as an Atom feed. Following it
//                                               is a reader asking; nothing is sent.
//
// Every decision is lib/sonara-growth-channels.cjs. This file reads, writes and
// renders.
//
// ## The reads a stranger's request makes
//
// /channels reads growth_channel_directory, which has no organization_id at all,
// so the cross-organization page cannot reach tenant data. /channels/:handle
// makes one unscoped read -- growth_channels by its unique handle with
// state=eq.public -- which lib/sonara-tenant-guard.cjs admits only in exactly that
// shape, and every read after it carries the organization_id that row returned.
//
// ## What nothing here does
//
// Sends anything. A post notifies nobody and an announcement is a post shown
// first. Hides a post because it was reported -- the owner decides. Deletes
// anything a business would later ask about.

const channels = require("../lib/sonara-growth-channels.cjs");
const safety = require("../lib/sonara-growth-channel-safety.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireWorkspaceAccess", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter",
  "requireCustomer", "resolveCustomerSession"
];

const CHANNEL_TABLE = "growth_channels";
const POST_TABLE = "growth_channel_posts";
const REPORT_TABLE = "growth_post_reports";
const DIRECTORY_TABLE = "growth_channel_directory";
const EVENT_TABLE = "growth_events";
const BLOCK_TABLE = "growth_channel_blocks";
const MODERATION_AUDIT_TABLE = "growth_channel_moderation_events";

// Read one past each cap, so a truncated list says so rather than looking short.
const CHANNEL_CAP = channels.CHANNELS_PER_ORGANIZATION;
const POST_CAP = 200;
const REPORT_CAP = 500;
const DIRECTORY_CAP = 200;

function registerGrowthChannelRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerGrowthChannelRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireWorkspaceAccess, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders, createRateLimiter,
    requireCustomer, resolveCustomerSession
  } = deps;

  const enc = encodeURIComponent;
  const OWNER_PAGE = "/growth-studio/owner/channels";
  const guard = requireWorkspaceAccess("growth_studio");

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

  async function rest(config, path) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const body = await response.json().catch(() => null);
    return { ok: Array.isArray(body), rows: Array.isArray(body) ? body : [], status: response.status };
  }

  async function write(config, path, payload, method = "POST", prefer = "return=minimal") {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: prefer },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok), status: response?.status || 0 };
  }


  // Account-level block lists are private, server-read and must fail closed.
  // Anonymous readers have no account block state. RSS readers without a session
  // are also anonymous and must not be advertised as block-aware.
  async function viewerBlocks(req, res, config) {
    const session = await resolveCustomerSession(req, res).catch(() => ({ ok: false }));
    const viewer = session?.ok ? session.user : null;
    if (!viewer?.id) return { ok: true, viewer: null, rows: [] };
    if (!safety.isUuid(viewer.id)) return { ok: false, viewer, rows: [] };
    const blocks = await rest(config,
      `${BLOCK_TABLE}?select=channel_id&viewer_user_id=eq.${enc(viewer.id)}&limit=${safety.MAX_BLOCKED + 1}`);
    if (!blocks.ok || blocks.rows.length > safety.MAX_BLOCKED ||
      !safety.visibleDirectory([], blocks.rows).ok) {
      return { ok: false, viewer, rows: [] };
    }
    return { ok: true, viewer, rows: blocks.rows };
  }

  const blockLimiter = createRateLimiter({
    name: "growth_channel_block_toggle",
    windowSeconds: 3600, maxAttempts: 60, scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.get("/account/blocked-channels", requireCustomer, async (req, res) => {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return failedPage(res, "Your blocked channels cannot be read just now.", 503);
    const blocks = await rest(config,
      `${BLOCK_TABLE}?select=channel_id&viewer_user_id=eq.${enc(req.sonaraUser.id)}&limit=${safety.MAX_BLOCKED + 1}`);
    if (!blocks.ok || blocks.rows.length > safety.MAX_BLOCKED || !safety.visibleDirectory([], blocks.rows).ok) {
      return failedPage(res, "Your blocked channels cannot be read just now. Nothing was changed.", 503);
    }
    const directory = await rest(config,
      `${DIRECTORY_TABLE}?select=channel_id,handle,title&limit=${DIRECTORY_CAP + 1}`);
    if (!directory.ok) return failedPage(res, "We could not load channel names. Your blocks are still in place.", 503);
    const labels = new Map(directory.rows.map((item) => [item.channel_id, item]));
    const entries = blocks.rows.map((entry) => {
      const item = labels.get(entry.channel_id);
      const title = item ? item.title || item.handle : "A channel not currently listed";
      return `<li><span>${escapeHtml(title)}</span> <form method="post" action="/api/growth/channels/${enc(entry.channel_id)}/unblock">
        <button type="submit">Unblock channel</button></form></li>`;
    });
    return res.status(200).type("html").send(layout({
      title: "Blocked channels", eyebrow: "Your account", heading: "Blocked channels",
      body: "Blocked channels are removed from your signed-in SONARA directory and channel pages. Anonymous browsers and outside feed readers are not tied to this account.",
      sections: [brandCard("Your blocks", entries.length ? `<ul>${entries.join("")}</ul>` : "You have not blocked any channels.")],
      actions: [linkAction("/channels", "All channels"), linkAction("/account", "Your account")]
    }));
  });

  async function changeBlock(req, res, blocking) {
    const id = String(req.params.id || "");
    if (!safety.isUuid(id) || !safety.isUuid(req.sonaraUser?.id)) {
      return res.status(400).type("text/plain").send("Invalid channel.");
    }
    const config = getSupabaseServerConfig();
    if (!config?.ok) return res.status(503).type("text/plain").send("Your block could not be saved.");
    const result = blocking
      ? await write(config, `${BLOCK_TABLE}?on_conflict=viewer_user_id,channel_id`,
          { viewer_user_id: req.sonaraUser.id, channel_id: id }, "POST",
          "resolution=ignore-duplicates,return=minimal")
      : await write(config,
          `${BLOCK_TABLE}?viewer_user_id=eq.${enc(req.sonaraUser.id)}&channel_id=eq.${enc(id)}`,
          undefined, "DELETE");
    if (!result.ok) return res.status(503).type("text/plain").send("Your block could not be saved.");
    return res.redirect(303, "/account/blocked-channels");
  }

  app.post("/api/growth/channels/:id/block", requireCustomer, blockLimiter,
    (req, res) => changeBlock(req, res, true));
  app.post("/api/growth/channels/:id/unblock", requireCustomer, blockLimiter,
    (req, res) => changeBlock(req, res, false));

  // One database RPC changes the post/reports AND inserts the audit event in
  // one transaction. It checks the current organization membership itself.
  async function moderatePost(req, res, action) {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedPost(scope, String(req.body?.post_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "post_missing" }));
    const intent = safety.moderationInput({
      action, actorId: scope.userId, organizationId: scope.organizationId,
      postId: owned.post.id, ownedPostId: owned.post.id, ownedOrganizationId: scope.organizationId
    });
    if (!intent.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const response = await fetch(`${scope.config.url}/rest/v1/rpc/sonara_moderate_growth_post`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json" },
      body: JSON.stringify({
        p_organization_id: intent.organizationId,
        p_post_id: intent.postId, p_actor_user_id: intent.actorId, p_action: action
      })
    }).catch(() => undefined);
    const committed = response?.ok ? await response.json().catch(() => false) : false;
    if (committed !== true) return res.redirect(303, back({ problem: "save_failed" }));
    return res.redirect(303, back({ done: action === "remove" ? "removed" : action === "restore" ? "restored" : "dismissed" }));
  }

  // Codes in the URL, sentences looked up here, so a crafted link cannot put text
  // in this product's voice on an authenticated page.
  const DONE_SENTENCES = Object.freeze({
    created: "That channel is saved as a draft. Nobody outside your workspace can see it yet.",
    published: "That channel is public and listed in the directory.",
    hidden: "That channel is hidden and out of the directory.",
    posted: "Posted.",
    removed: "That post is down. Its reports are marked as dealt with.",
    restored: "That post is back up.",
    dismissed: "Those reports are dismissed and the post stays up."
  });
  const noticeFor = (query) => DONE_SENTENCES[String(query?.done || "")]
    || channels.problemSentence(String(query?.problem || "")) || null;
  const back = (params) => `${OWNER_PAGE}?${new URLSearchParams(params).toString()}`;

  const failedPage = (res, sentence, status = 200) => res.status(status).type("html").send(layout({
    title: "Your channels",
    eyebrow: "Growth Studio",
    heading: "Your channels",
    body: sentence,
    sections: [],
    actions: [linkAction("/growth-studio", "Growth Studio")]
  }));

  // ---------------------------------------------------------------------------
  // The owner's view
  // ---------------------------------------------------------------------------

  app.get(OWNER_PAGE, guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) {
      return failedPage(res, "We could not reach your workspace just now. This is a problem on our side, and it is not telling you that you have no channels.", 503);
    }
    const org = `organization_id=eq.${enc(scope.organizationId)}`;
    const [list, posts, reports, events] = await Promise.all([
      rest(scope.config, `${CHANNEL_TABLE}?select=id,handle,title,about,state,published_at&${org}&order=created_at.desc&limit=${CHANNEL_CAP + 1}`),
      rest(scope.config, `${POST_TABLE}?select=id,channel_id,kind,body,event_id,state,created_at&${org}&order=created_at.desc&limit=${POST_CAP + 1}`),
      rest(scope.config, `${REPORT_TABLE}?select=post_id,reason,state&${org}&state=eq.open&limit=${REPORT_CAP + 1}`),
      rest(scope.config, `${EVENT_TABLE}?select=id,title,slug&${org}&status=eq.published&order=starts_at.desc&limit=100`)
    ]);

    // A failed read renders as a failed read. An empty page here is a sentence:
    // it says you have no channels, or nobody has flagged anything.
    if (!list.ok || !posts.ok || !reports.ok || !events.ok) {
      return failedPage(res, "We could not read part of your channels just now. Nothing has changed, and this is not a list of them -- try again shortly.");
    }

    const summary = channels.reportSummary(reports.rows.slice(0, REPORT_CAP));
    const postsByChannel = new Map();
    for (const post of posts.rows.slice(0, POST_CAP)) {
      if (!postsByChannel.has(post.channel_id)) postsByChannel.set(post.channel_id, []);
      postsByChannel.get(post.channel_id).push(post);
    }

    const sections = [];
    // A Growth channel is a basic free login-based SONARA social surface.
    // The subscription policy is shared across parent, Business Builder,
    // Creator Studio and Growth Studio; it is NOT a payment or publish grant.
    const channelSurface = FREE_SURFACE_CATALOG.find((item) =>
      item.product === "growth_studio" && item.service === "social");
    if (channelSurface && channelSurface.platformSubscriptionRequired === false
      && channelSurface.platformPostingFeeCents === 0) {
      sections.push(brandCard("Your channel is free",
        "Create a channel and publish approved posts without a SONARA subscription or posting fee. " +
        "Your login, business permissions, moderation rules and published-content rights still apply. " +
        "Buying another product or using an independent provider is a separate choice."));
    }
    const notice = noticeFor(req.query);
    if (notice) sections.push(brandCard("What just happened", escapeHtml(notice)));
    if (reports.rows.length > REPORT_CAP) {
      sections.push(brandCard("More reports than shown", `Showing the first ${REPORT_CAP} open reports. There are more.`));
    }

    for (const channel of list.rows.slice(0, CHANNEL_CAP)) {
      const visibility = channels.channelVisibility(channel);
      const own = postsByChannel.get(channel.id) || [];
      const lines = [
        `<p>${escapeHtml(visibility.sentence)}</p>`,
        `<p>Address: /channels/${escapeHtml(channel.handle)}</p>`,
        channel.about ? `<p>${escapeHtml(channel.about)}</p>` : ""
      ];
      lines.push(channel.state === "public" ? hideForm(channel) : publishForm(channel));
      lines.push(postForm(channel, events.rows));
      if (own.length) {
        lines.push("<ul>" + own.slice(0, 30).map((post) => postItem(post, summary.byPost.get(post.id))).join("") + "</ul>");
        if (own.length > 30) lines.push(`<p>Showing the newest 30 of ${own.length}.</p>`);
      } else {
        lines.push("<p>Nothing posted yet.</p>");
      }
      sections.push(brandCard(`${channel.title} (${channel.state})`, lines.join("")));
    }

    if (!list.rows.length) {
      sections.push(brandCard("No channels yet", "A channel is a public page you post to. It starts as a draft, and nobody sees it until you make it public."));
    }
    if (list.rows.length < CHANNEL_CAP) sections.push(brandCard("Start a channel", channelForm()));

    return res.status(200).type("html").send(layout({
      title: "Your channels",
      eyebrow: "Growth Studio",
      heading: "Your channels",
      body: "Post updates and announcements to a public page. Posting sends nothing to anybody -- people read your channel when they choose to. Reports from readers come here, and you decide what stays up.",
      sections,
      actions: [linkAction("/growth-studio", "Growth Studio"), linkAction("/channels", "The channel directory")]
    }));
  });

  // ---------------------------------------------------------------------------
  // The forms
  // ---------------------------------------------------------------------------

  const hidden = (name, value) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;

  const channelForm = () => `
    <form action="/api/growth/channels" method="post">
      <label for="channel-title">What is the channel called?</label>
      <input id="channel-title" name="title" type="text" maxlength="${channels.TITLE_MAX}" required>
      <label for="channel-handle">Its address: /channels/…</label>
      <input id="channel-handle" name="handle" type="text" maxlength="32" required>
      <label for="channel-about">What it is about</label>
      <textarea id="channel-about" name="about" maxlength="${channels.ABOUT_MAX}" rows="3"></textarea>
      <button type="submit">Save as a draft</button>
    </form>`;

  const publishForm = (channel) => `
    <form action="/api/growth/channels/publish" method="post">
      ${hidden("channel_id", channel.id)}
      <button type="submit">Make this channel public</button>
    </form>`;

  const hideForm = (channel) => `
    <form action="/api/growth/channels/hide" method="post">
      ${hidden("channel_id", channel.id)}
      <button type="submit">Hide this channel</button>
    </form>`;

  const postForm = (channel, eventRows) => `
    <form action="/api/growth/channels/posts" method="post">
      ${hidden("channel_id", channel.id)}
      <label for="post-body-${escapeHtml(channel.id)}">Say something</label>
      <textarea id="post-body-${escapeHtml(channel.id)}" name="body" maxlength="${channels.BODY_MAX}" rows="4" required></textarea>
      <label for="post-kind-${escapeHtml(channel.id)}">Is it an announcement? Announcements are shown first</label>
      <select id="post-kind-${escapeHtml(channel.id)}" name="kind">
        <option value="post" selected>A post</option>
        <option value="announcement">An announcement</option>
      </select>
      <label for="post-event-${escapeHtml(channel.id)}">About one of your published events?</label>
      <select id="post-event-${escapeHtml(channel.id)}" name="event_id">
        <option value="">No event</option>
        ${eventRows.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.title || "An event")}</option>`).join("")}
      </select>
      <p>Links are shown as text, not made clickable.</p>
      <button type="submit">Post</button>
    </form>`;

  function postItem(post, flagged) {
    const reasons = flagged
      ? Object.entries(flagged.reasons).map(([reason, count]) => `${escapeHtml(reason)} ${count}`).join(", ")
      : "";
    const action = post.state === "removed"
      ? `<form action="/api/growth/channels/posts/restore" method="post">${hidden("post_id", post.id)}<button type="submit">Put it back</button></form>`
      : `<form action="/api/growth/channels/posts/remove" method="post">${hidden("post_id", post.id)}<button type="submit">Take it down</button></form>`;
    const dismiss = flagged && post.state !== "removed"
      ? `<form action="/api/growth/channels/reports/dismiss" method="post">${hidden("post_id", post.id)}<button type="submit">Leave it up and dismiss the reports</button></form>`
      : "";
    return `<li><p>${post.kind === "announcement" ? "<strong>Announcement.</strong> " : ""}${channels.bodyHtml(post.body, escapeHtml)}</p>`
      + `<p>${post.created_at ? `${escapeHtml(new Date(post.created_at).toUTCString())}, ` : ""}${escapeHtml(post.state)}${flagged ? ` -- reported ${flagged.total} ${flagged.total === 1 ? "time" : "times"} (${reasons})` : ""}</p>`
      + `${action}${dismiss}</li>`;
  }

  // ---------------------------------------------------------------------------
  // Owner writes
  // ---------------------------------------------------------------------------

  async function ownedChannel(scope, channelId) {
    if (!channels.isUuid(channelId)) return { ok: false };
    const found = await rest(scope.config,
      `${CHANNEL_TABLE}?select=id,handle,title,about,state&id=eq.${enc(channelId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!found.ok || !found.rows[0]) return { ok: false };
    return { ok: true, channel: found.rows[0] };
  }

  async function ownedPost(scope, postId) {
    if (!channels.isUuid(postId)) return { ok: false };
    const found = await rest(scope.config,
      `${POST_TABLE}?select=id,channel_id,state&id=eq.${enc(postId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!found.ok || !found.rows[0]) return { ok: false };
    return { ok: true, post: found.rows[0] };
  }

  app.post("/api/growth/channels", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const normalized = channels.normalizeChannel(req.body || {});
    if (!normalized.ok) return res.redirect(303, back({ problem: normalized.problems[0] }));

    // The cap, counted rather than assumed.
    const existing = await rest(scope.config,
      `${CHANNEL_TABLE}?select=id&organization_id=eq.${enc(scope.organizationId)}&limit=${CHANNEL_CAP + 1}`);
    if (!existing.ok) return res.redirect(303, back({ problem: "save_failed" }));
    if (existing.rows.length >= CHANNEL_CAP) return res.redirect(303, back({ problem: "channel_cap" }));

    // Taken by somebody else is a sentence, not a constraint violation. Only
    // organization_id is selected; the guard admits this lookup in no wider shape.
    const taken = await rest(scope.config,
      `${CHANNEL_TABLE}?select=organization_id&handle=eq.${enc(normalized.channel.handle)}&limit=1`);
    if (!taken.ok) return res.redirect(303, back({ problem: "save_failed" }));
    if (taken.rows.length) return res.redirect(303, back({ problem: "handle_taken" }));

    const written = await write(scope.config, CHANNEL_TABLE, {
      organization_id: scope.organizationId,
      handle: normalized.channel.handle,
      title: normalized.channel.title,
      about: normalized.channel.about,
      // A draft, always. Making it public is its own action.
      state: "draft",
      created_by: scope.userId
    });
    return res.redirect(303, back(written.ok ? { done: "created" } : { problem: written.status === 409 ? "handle_taken" : "save_failed" }));
  });

  app.post("/api/growth/channels/publish", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedChannel(scope, String(req.body?.channel_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "channel_missing" }));

    const now = new Date().toISOString();
    const patched = await write(scope.config,
      `${CHANNEL_TABLE}?id=eq.${enc(owned.channel.id)}&organization_id=eq.${enc(scope.organizationId)}`,
      { state: "public", published_at: now, updated_at: now }, "PATCH");
    if (!patched.ok) return res.redirect(303, back({ problem: "save_failed" }));

    // Public first, then listed. If the listing fails the channel works at its
    // own address and the owner is told it is not in the directory -- the other
    // order could list a channel whose page refuses everyone.
    const listed = await write(scope.config, `${DIRECTORY_TABLE}?on_conflict=channel_id`,
      channels.directoryRow(owned.channel), "POST", "resolution=merge-duplicates,return=minimal");
    return res.redirect(303, back(listed.ok ? { done: "published" } : { problem: "not_listed" }));
  });

  app.post("/api/growth/channels/hide", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedChannel(scope, String(req.body?.channel_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "channel_missing" }));

    // Out of the directory first, then hidden -- so a failure between the two
    // leaves a channel that is public but unlisted, never one that is listed and
    // refuses everyone who follows the listing.
    const unlisted = await write(scope.config,
      `${DIRECTORY_TABLE}?channel_id=eq.${enc(owned.channel.id)}`, undefined, "DELETE");
    if (!unlisted.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const patched = await write(scope.config,
      `${CHANNEL_TABLE}?id=eq.${enc(owned.channel.id)}&organization_id=eq.${enc(scope.organizationId)}`,
      { state: "hidden", updated_at: new Date().toISOString() }, "PATCH");
    return res.redirect(303, back(patched.ok ? { done: "hidden" } : { problem: "still_public" }));
  });

  app.post("/api/growth/channels/posts", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedChannel(scope, String(req.body?.channel_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "channel_missing" }));

    const normalized = channels.normalizePost(req.body || {});
    if (!normalized.ok) return res.redirect(303, back({ problem: normalized.problems[0] }));

    // An event has to be this organization's and published. Checked rather than
    // assumed: the service-role key bypasses row level security, and an id alone
    // is not an authorization.
    if (normalized.post.eventId) {
      const event = await rest(scope.config,
        `${EVENT_TABLE}?select=id&id=eq.${enc(normalized.post.eventId)}&organization_id=eq.${enc(scope.organizationId)}&status=eq.published&limit=1`);
      if (!event.ok || !event.rows.length) return res.redirect(303, back({ problem: "event_missing" }));
    }

    const written = await write(scope.config, POST_TABLE, {
      organization_id: scope.organizationId,
      channel_id: owned.channel.id,
      author_user_id: scope.userId,
      kind: normalized.post.kind,
      body: normalized.post.body,
      event_id: normalized.post.eventId,
      state: "published"
    });
    return res.redirect(303, back(written.ok ? { done: "posted" } : { problem: "save_failed" }));
  });

  app.post("/api/growth/channels/posts/remove", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedPost(scope, String(req.body?.post_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "post_missing" }));

    const now = new Date().toISOString();
    const patched = await write(scope.config,
      `${POST_TABLE}?id=eq.${enc(owned.post.id)}&organization_id=eq.${enc(scope.organizationId)}`,
      { state: "removed", removed_at: now, updated_at: now }, "PATCH");
    if (!patched.ok) return res.redirect(303, back({ problem: "save_failed" }));

    // The post is down whatever happens next; the reports catching up is
    // bookkeeping, and a failure there does not put the post back.
    await write(scope.config,
      `${REPORT_TABLE}?post_id=eq.${enc(owned.post.id)}&organization_id=eq.${enc(scope.organizationId)}&state=eq.open`,
      { state: "actioned", decided_at: now }, "PATCH");
    return res.redirect(303, back({ done: "removed" }));
  });

  app.post("/api/growth/channels/posts/restore", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedPost(scope, String(req.body?.post_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "post_missing" }));

    const patched = await write(scope.config,
      `${POST_TABLE}?id=eq.${enc(owned.post.id)}&organization_id=eq.${enc(scope.organizationId)}`,
      { state: "published", removed_at: null, updated_at: new Date().toISOString() }, "PATCH");
    return res.redirect(303, back(patched.ok ? { done: "restored" } : { problem: "save_failed" }));
  });

  app.post("/api/growth/channels/reports/dismiss", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));
    const owned = await ownedPost(scope, String(req.body?.post_id || "").trim());
    if (!owned.ok) return res.redirect(303, back({ problem: "post_missing" }));

    const patched = await write(scope.config,
      `${REPORT_TABLE}?post_id=eq.${enc(owned.post.id)}&organization_id=eq.${enc(scope.organizationId)}&state=eq.open`,
      { state: "dismissed", decided_at: new Date().toISOString() }, "PATCH");
    return res.redirect(303, back(patched.ok ? { done: "dismissed" } : { problem: "save_failed" }));
  });

  // ---------------------------------------------------------------------------
  // The public pages
  // ---------------------------------------------------------------------------

  // `surface` is "marketing" only for the directory: tests/marketing-surface-rule.test.js
  // holds /channels to the front-door stage, and a single channel is a page read,
  // not a door.
  const publicPage = (res, { heading, body, sections = [], status = 200, eyebrow = "Channel", surface = "work" }) =>
    res.status(status).type("html").send(layout({
      title: heading,
      eyebrow,
      heading,
      body,
      sections,
      surface,
      actions: [linkAction("/channels", "All channels"), linkAction("/", "SONARA One")]
    }));

  const notFound = (res) => publicPage(res, {
    heading: "No such channel",
    body: "This address does not match a public channel. It may never have been made public, or its owner may have hidden it.",
    status: 404
  });
  const unavailable = (res) => publicPage(res, {
    heading: "We cannot reach this just now",
    body: "This is a problem on our side rather than anything to do with the channel. Nothing has changed -- try again shortly.",
    status: 503
  });

  app.get("/channels", async (req, res) => {
    // The page renders either way and says which: a front door that answers 503
    // turns a reader away at the door, and /marketplace makes the same choice. What
    // it must never do is render a failed read as "no public channels yet".
    const config = getSupabaseServerConfig();
    const listed = config?.ok
      ? await rest(config, `${DIRECTORY_TABLE}?select=handle,title,about&order=listed_at.desc&limit=${DIRECTORY_CAP + 1}`)
      : { ok: false, rows: [] };
    if (!listed.ok) {
      return publicPage(res, {
        eyebrow: "Growth Studio",
        surface: "marketing",
        heading: "Channels",
        body: "Public pages businesses post updates and announcements to.",
        sections: [brandCard("We could not read the directory just now",
          "That is a problem on our side, and it does not mean there are no channels. Nothing has been removed.")]
      });
    }
    const rows = listed.rows.slice(0, DIRECTORY_CAP);
    const sections = rows.length
      ? [brandCard(`${rows.length}${listed.rows.length > DIRECTORY_CAP ? "+" : ""} public ${rows.length === 1 ? "channel" : "channels"}`,
        "<ul>" + rows.map((row) => `<li><a href="/channels/${escapeHtml(enc(row.handle))}">${escapeHtml(row.title || row.handle)}</a>`
          + `${row.about ? ` -- ${escapeHtml(String(row.about).slice(0, 200))}` : ""}</li>`).join("") + "</ul>")]
      : [brandCard("No public channels yet", "Businesses on SONARA One can start a channel from Growth Studio. When one is made public it is listed here.")];
    return publicPage(res, {
      eyebrow: "Growth Studio",
      surface: "marketing",
      heading: "Channels",
      body: "Public pages businesses post updates and announcements to. Read any of them without an account; nothing here signs you up for anything.",
      sections
    });
  });

  // One public channel by its handle: the single unscoped read, in the exact
  // shape lib/sonara-tenant-guard.cjs pins.
  async function findPublicChannel(config, handle) {
    const found = await rest(config,
      `${CHANNEL_TABLE}?select=id,organization_id,handle,title,about,state&handle=eq.${enc(handle)}&state=eq.public&limit=1`);
    if (!found.ok) return { ok: false, channel: null };
    return { ok: true, channel: found.rows[0] || null };
  }

  // Posts and the events they link to, scoped by the organization the channel row
  // named. Only the columns a stranger may see of a post are selected -- not the
  // author -- and published ones only.
  async function publicPostsFor(config, channel) {
    const org = `organization_id=eq.${enc(channel.organization_id)}`;
    const posts = await rest(config,
      `${POST_TABLE}?select=id,kind,body,event_id,state,created_at&channel_id=eq.${enc(channel.id)}&${org}&state=eq.published&order=created_at.desc&limit=${POST_CAP + 1}`);
    if (!posts.ok) return { ok: false, arranged: null };
    const eventIds = [...new Set(posts.rows.map((row) => row.event_id).filter(channels.isUuid))];
    const eventLinks = new Map();
    if (eventIds.length) {
      const events = await rest(config,
        `${EVENT_TABLE}?select=id,slug,title&id=in.(${enc(eventIds.join(","))})&${org}&status=neq.draft&slug=not.is.null`);
      // A failed event read costs the links, not the page: the posts are still
      // true without them.
      if (events.ok) for (const event of events.rows) eventLinks.set(event.id, event);
    }
    return { ok: true, arranged: channels.arrangePublicPosts(posts.rows, { eventLinks, channel }) };
  }

  const reportForm = (handle, post) => `
    <details><summary>Report this post</summary>
    <form action="/channels/${escapeHtml(enc(handle))}/report" method="post">
      ${hidden("post_id", post.id)}
      <label for="reason-${escapeHtml(post.id)}">What is wrong with it?</label>
      <select id="reason-${escapeHtml(post.id)}" name="reason" required>
        <option value="">Choose one</option>
        ${channels.REPORT_REASONS.map((reason) => `<option value="${reason}">${reason}</option>`).join("")}
      </select>
      <label for="note-${escapeHtml(post.id)}">Anything the business should know (optional)</label>
      <input id="note-${escapeHtml(post.id)}" name="note" type="text" maxlength="${channels.NOTE_MAX}">
      <button type="submit">Send the report</button>
    </form></details>`;

  const postCard = (handle, post, title) => brandCard(title,
    `<p>${channels.bodyHtml(post.body, escapeHtml)}</p>`
    + (post.event ? `<p><a href="/events/${escapeHtml(enc(post.event.slug))}">${escapeHtml(post.event.title || "The event")}</a></p>` : "")
    + (post.createdAt ? `<p>${escapeHtml(new Date(post.createdAt).toUTCString())}</p>` : "")
    + reportForm(handle, post));

  app.get("/channels/:handle", async (req, res) => {
    const checked = channels.normalizeChannel({ handle: req.params.handle, title: "x" });
    if (!checked.ok) return notFound(res);
    const handle = checked.channel.handle;

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);
    const found = await findPublicChannel(config, handle);
    if (!found.ok) return unavailable(res);
    if (!found.channel) return notFound(res);

    const posts = await publicPostsFor(config, found.channel);
    const sections = [];
    if (!posts.ok) {
      sections.push(brandCard("Posts", "We could not read this channel's posts just now. That is a problem on our side, and it does not mean nothing has been posted."));
    } else {
      for (const post of posts.arranged.announcements) sections.push(postCard(handle, post, "Announcement"));
      for (const post of posts.arranged.posts) sections.push(postCard(handle, post, "Post"));
      if (!posts.arranged.announcements.length && !posts.arranged.posts.length) {
        sections.push(brandCard("Nothing posted yet", "This channel has not posted anything."));
      }
      if (posts.arranged.truncated) sections.push(brandCard("Older posts", `Showing the newest ${channels.POSTS_SHOWN}.`));
    }
    sections.push(brandCard("Follow this channel",
      `<p>Add <a href="/channels/${escapeHtml(enc(handle))}/feed.xml">this channel's feed</a> to any feed reader to see new posts there. `
      + "Nothing is sent to you, and nobody here learns that you follow it.</p>"));
    sections.push(brandCard("About reports",
      "A report goes to the business that runs this channel, with no name or address attached. Reporting does not take a post down by itself; the business decides."));

    return publicPage(res, {
      heading: found.channel.title || found.channel.handle,
      body: String(found.channel.about || "").trim() || "No description was written for this channel.",
      sections
    });
  });

  // The same reads as the page, through the same pinned lookup, as Atom. A reader
  // polls this; it is cached briefly so a popular channel is not re-read for every
  // poll. A channel that is not public answers 404 like the page does.
  app.get("/channels/:handle/feed.xml", async (req, res) => {
    const checked = channels.normalizeChannel({ handle: req.params.handle, title: "x" });
    if (!checked.ok) return res.status(404).type("text/plain").send("No such channel.");
    const config = getSupabaseServerConfig();
    if (!config?.ok) return res.status(503).type("text/plain").send("This feed cannot be read just now.");
    const found = await findPublicChannel(config, checked.channel.handle);
    if (!found.ok) return res.status(503).type("text/plain").send("This feed cannot be read just now.");
    if (!found.channel) return res.status(404).type("text/plain").send("No such channel.");
    const posts = await publicPostsFor(config, found.channel);
    // An unreadable post list is not an empty channel. A feed answering with no
    // entries would tell every reader the channel had gone quiet.
    if (!posts.ok) return res.status(503).type("text/plain").send("This feed cannot be read just now.");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).type("application/atom+xml; charset=utf-8").send(channels.atomFeed({
      channel: found.channel,
      arranged: posts.arranged,
      origin: siteOrigin(req)
    }));
  });

  // Ten an hour from one address. A public, anonymous write: the ceiling is where
  // a reader flagging several posts stays under it and a script does not.
  const reportLimiter = createRateLimiter({
    name: "public_channel_report",
    windowSeconds: 3600,
    maxAttempts: 10,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.post("/channels/:handle/report", reportLimiter, async (req, res) => {
    const checked = channels.normalizeChannel({ handle: req.params.handle, title: "x" });
    if (!checked.ok) return notFound(res);
    const handle = checked.channel.handle;

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);
    const found = await findPublicChannel(config, handle);
    if (!found.ok) return unavailable(res);
    if (!found.channel) return notFound(res);

    const normalized = channels.normalizeReport(req.body || {});
    if (!normalized.ok) {
      return publicPage(res, {
        heading: found.channel.title || handle,
        body: channels.problemSentence(normalized.problems[0]) || "We could not read that report.",
        status: 400
      });
    }

    // The post has to be on this channel, this organization's, and up.
    const post = await rest(config,
      `${POST_TABLE}?select=id&id=eq.${enc(normalized.report.postId)}&channel_id=eq.${enc(found.channel.id)}`
      + `&organization_id=eq.${enc(found.channel.organization_id)}&state=eq.published&limit=1`);
    if (!post.ok) return unavailable(res);
    if (!post.rows.length) {
      return publicPage(res, { heading: found.channel.title || handle, body: channels.problemSentence("post_missing"), status: 404 });
    }

    const written = await write(config, REPORT_TABLE, {
      organization_id: found.channel.organization_id,
      post_id: normalized.report.postId,
      reason: normalized.report.reason,
      note: normalized.report.note,
      state: "open"
    });
    if (!written.ok) return unavailable(res);
    return publicPage(res, {
      heading: found.channel.title || handle,
      body: "Thank you. Your report has gone to the business that runs this channel. Nothing identifying you was sent with it, and nothing will be sent to you."
    });
  });
}

module.exports = registerGrowthChannelRoutes;
