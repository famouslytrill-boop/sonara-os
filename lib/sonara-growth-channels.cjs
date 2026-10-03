// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What a channel may say in public, and what a stranger may see of it.
//
// Every decision about a channel lives here. routes/sonara-growth-channel-routes.cjs
// reads, writes and renders; it does not decide what is public, because a page
// that asks and then renders regardless is a gate that was never there.
//
// ## The three invariants
//
// **1. Public means published, on a public channel, now.** A post is shown to a
// stranger only while its state is `published` AND its channel's state is
// `public`. `publicPosts` drops anything else even if a query hands it over, so a
// query that forgot its filter still cannot put a removed post on the page.
//
// **2. A stranger sees what was said, never who said it.** `publicPost` builds its
// result by naming fields -- id, kind, body, when, and an event link -- and has no
// author, organization or report field to forward. Reports are the business's
// record and are never counted on a public page: a visible "12 reports" is an
// invitation to send a thirteenth.
//
// **3. A report is a signal to the owner, not a verdict.** Nothing here hides a
// post because it was reported. `reportSummary` counts open reports per post for
// the owner page, and only the owner removes.
//
// ## What is deliberately not here
//
// No sending. A post notifies nobody; an announcement is a post shown first. And
// no links: a body is plain text, escaped, with line breaks kept. An address in a
// post reads as an address and is not made clickable, so a channel cannot be used
// to put a one-click phishing link in front of its readers.

const { checkHandle } = require("./sonara-creator-profiles.cjs");

const CHANNEL_STATES = Object.freeze(["draft", "public", "hidden"]);
const POST_KINDS = Object.freeze(["post", "announcement"]);
const POST_STATES = Object.freeze(["published", "removed"]);
const REPORT_REASONS = Object.freeze(["spam", "harassment", "hate", "violence", "sexual", "illegal", "misleading", "other"]);
const REPORT_STATES = Object.freeze(["open", "dismissed", "actioned"]);

const TITLE_MAX = 120;
const ABOUT_MAX = 1000;
const BODY_MAX = 2000;
const NOTE_MAX = 500;
// A business runs a handful of channels, not hundreds. The cap is what keeps one
// account from filling the public directory.
const CHANNELS_PER_ORGANIZATION = 20;
const ANNOUNCEMENTS_SHOWN = 3;
const POSTS_SHOWN = 50;

// Control characters other than tab and line breaks. Postgres refuses NUL outright,
// and the rest render as nothing while still counting toward the length.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

/**
 * A channel out of a form. `{ ok, channel }` or `{ ok: false, problems }`, where
 * problems are codes -- codes rather than sentences, because they round-trip
 * through a query string and a sentence in a URL is text a crafted link can put
 * in this product's voice.
 */
function normalizeChannel(input = {}) {
  const problems = [];
  const checked = checkHandle(input.handle);
  if (!checked.ok) problems.push(checked.code);

  const title = String(input.title ?? "").trim();
  if (!title) problems.push("title_missing");
  else if (title.length > TITLE_MAX) problems.push("title_long");
  else if (CONTROL.test(title)) problems.push("text_control");

  const about = String(input.about ?? "").trim();
  if (about.length > ABOUT_MAX) problems.push("about_long");
  else if (CONTROL.test(about)) problems.push("text_control");

  if (problems.length) return { ok: false, problems: Object.freeze([...new Set(problems)]) };
  return { ok: true, channel: Object.freeze({ handle: checked.handle, title, about: about || null }) };
}

/**
 * A post out of a form. `eventId` is null when none was chosen; whether the
 * event is this organization's is the route's to check, with the organization in
 * hand.
 */
function normalizePost(input = {}) {
  const problems = [];
  const kind = String(input.kind ?? "post").trim().toLowerCase() || "post";
  if (!POST_KINDS.includes(kind)) problems.push("kind_unknown");

  // Line endings normalised, so a body pasted from one system is not two
  // characters a line longer than the same body typed on another.
  const body = String(input.body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!body) problems.push("body_missing");
  else if (body.length > BODY_MAX) problems.push("body_long");
  else if (CONTROL.test(body)) problems.push("text_control");

  const eventRaw = String(input.event_id ?? input.eventId ?? "").trim();
  let eventId = null;
  if (eventRaw) {
    if (!isUuid(eventRaw)) problems.push("event_missing");
    else eventId = eventRaw.toLowerCase();
  }

  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, post: Object.freeze({ kind, body, eventId }) };
}

/**
 * A report out of the public form. The note is optional; the reason is not,
 * because "something is wrong" with no reason is a report nobody can act on.
 */
function normalizeReport(input = {}) {
  const problems = [];
  const postId = String(input.post_id ?? "").trim();
  if (!isUuid(postId)) problems.push("post_missing");
  const reason = String(input.reason ?? "").trim().toLowerCase();
  if (!REPORT_REASONS.includes(reason)) problems.push("reason_missing");
  const note = String(input.note ?? "").replace(/\r\n?/g, "\n").trim();
  if (note.length > NOTE_MAX) problems.push("note_long");
  else if (CONTROL.test(note)) problems.push("text_control");
  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, report: Object.freeze({ postId: postId.toLowerCase(), reason, note: note || null }) };
}

/**
 * Whether a channel is showing in public, and what to say if it is not.
 */
function channelVisibility(channel) {
  const state = String(channel?.state || "");
  if (!CHANNEL_STATES.includes(state)) {
    return Object.freeze({ public: false, code: "state_unknown", sentence: "We cannot tell what state this channel is in, so it is not shown to anybody." });
  }
  if (state === "public") return Object.freeze({ public: true, code: "public", sentence: "This channel is public. Anybody with the address can read it." });
  if (state === "hidden") return Object.freeze({ public: false, code: "hidden", sentence: "This channel is hidden. Nobody outside your workspace can open it, and it is not in the directory." });
  return Object.freeze({ public: false, code: "draft", sentence: "This channel is a draft. Nobody outside your workspace can see it until you make it public." });
}

/**
 * One post as a stranger may see it. Built by naming fields: there is no author,
 * organization, state or report field to forward, so a template cannot print one
 * by reaching for it.
 */
function publicPost(row, eventLinks = new Map()) {
  const eventId = row?.event_id || null;
  const link = eventId ? eventLinks.get(eventId) || null : null;
  return Object.freeze({
    id: String(row?.id || ""),
    kind: POST_KINDS.includes(row?.kind) ? row.kind : "post",
    body: String(row?.body || ""),
    createdAt: row?.created_at || null,
    // Only an event the route has confirmed is this organization's and not a
    // draft is in eventLinks; anything else is no link rather than a dead one.
    event: link ? Object.freeze({ slug: link.slug, title: link.title }) : null
  });
}

/**
 * The posts a public page shows, arranged: the newest announcements first, then
 * everything else newest first. Anything not published is dropped here even if
 * the query returned it, so a query that lost its state filter still cannot put a
 * removed post on the page. `truncated` says when there was more than was shown,
 * so the page can say so rather than pretend the list is complete.
 */
function arrangePublicPosts(rows, { eventLinks, channel } = {}) {
  if (!Array.isArray(rows)) return Object.freeze({ ok: false, announcements: [], posts: [], truncated: false });
  if (!channelVisibility(channel).public) return Object.freeze({ ok: true, announcements: [], posts: [], truncated: false });
  const published = rows
    .filter((row) => row && row.state === "published")
    .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  const announcements = published.filter((row) => row.kind === "announcement").slice(0, ANNOUNCEMENTS_SHOWN);
  const shownIds = new Set(announcements.map((row) => row.id));
  const rest = published.filter((row) => !shownIds.has(row.id));
  return Object.freeze({
    ok: true,
    announcements: Object.freeze(announcements.map((row) => publicPost(row, eventLinks))),
    posts: Object.freeze(rest.slice(0, POSTS_SHOWN).map((row) => publicPost(row, eventLinks))),
    truncated: rest.length > POSTS_SHOWN
  });
}

/**
 * A post body as HTML: escaped, line breaks kept, nothing made into a link.
 */
function bodyHtml(text, escapeHtml) {
  return String(text || "").split("\n").map((line) => escapeHtml(line)).join("<br>");
}

/**
 * Open reports per post, by reason, for the owner page. Carries `ok` so a read
 * that failed is never rendered as "no reports" -- an owner told nothing is
 * flagged, on the strength of a request that did not happen, stops looking.
 */
function reportSummary(rows) {
  if (!Array.isArray(rows)) return Object.freeze({ ok: false, byPost: new Map(), open: null });
  const byPost = new Map();
  let open = 0;
  for (const row of rows) {
    if (!row || row.state !== "open" || !row.post_id) continue;
    open += 1;
    const entry = byPost.get(row.post_id) || { total: 0, reasons: {} };
    entry.total += 1;
    entry.reasons[row.reason] = (entry.reasons[row.reason] || 0) + 1;
    byPost.set(row.post_id, entry);
  }
  return Object.freeze({ ok: true, byPost, open });
}

/**
 * The directory row for a public channel: exactly the columns the migration
 * asserts, built by naming them.
 */
function directoryRow(channel) {
  return Object.freeze({
    channel_id: channel.id,
    handle: channel.handle,
    title: channel.title,
    about: channel.about || null
  });
}

function problemSentence(code) {
  return Object.freeze({
    handle_required: "A channel needs an address. It becomes the end of its link: /channels/your-address.",
    handle_too_short: "A channel address needs at least 3 characters.",
    handle_too_long: "A channel address can be at most 32 characters.",
    handle_shape: "Use lowercase letters, numbers and hyphens only, starting and ending with a letter or number.",
    handle_reserved: "That address is not available. Try another one.",
    handle_taken: "Another channel already uses that address. Try another one.",
    title_missing: "A channel needs a name.",
    title_long: `A channel name has to be ${TITLE_MAX} characters or fewer.`,
    about_long: `A description has to be ${ABOUT_MAX} characters or fewer.`,
    text_control: "That text contains characters that cannot be shown. Retype it rather than pasting it.",
    kind_unknown: "A post is either a post or an announcement.",
    body_missing: "A post needs something in it.",
    body_long: `A post has to be ${BODY_MAX} characters or fewer.`,
    event_missing: "That event could not be found in this workspace, or it has not been published.",
    channel_missing: "That channel could not be found in this workspace.",
    channel_cap: `A workspace can have ${CHANNELS_PER_ORGANIZATION} channels. Hide one you no longer use, or post to one you have.`,
    post_missing: "That post could not be found.",
    reason_missing: "Choose what is wrong with the post.",
    note_long: `A note has to be ${NOTE_MAX} characters or fewer.`,
    not_listed: "The channel is public, but it could not be added to the directory just now. Its own page works; try making it public again to list it.",
    still_public: "The channel was taken out of the directory but is still public at its own address. Try hiding it again.",
    save_failed: "That did not save. Nothing has changed, and it is worth trying again."
  })[code] || null;
}

module.exports = {
  CHANNEL_STATES,
  POST_KINDS,
  POST_STATES,
  REPORT_REASONS,
  REPORT_STATES,
  TITLE_MAX,
  ABOUT_MAX,
  BODY_MAX,
  NOTE_MAX,
  CHANNELS_PER_ORGANIZATION,
  ANNOUNCEMENTS_SHOWN,
  POSTS_SHOWN,
  isUuid,
  normalizeChannel,
  normalizePost,
  normalizeReport,
  channelVisibility,
  publicPost,
  arrangePublicPosts,
  bodyHtml,
  reportSummary,
  directoryRow,
  problemSentence
};
