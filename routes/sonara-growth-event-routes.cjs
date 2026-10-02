// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Venues, events, and a public page a stranger can RSVP on.
//
//   GET  /growth-studio/owner/events     the owner's view: venues, events, who is coming
//   POST /api/growth/venues              add a venue
//   POST /api/growth/events              add an event
//   POST /api/growth/events/publish      give it a public address and publish it
//   POST /api/growth/events/cancel       cancel it, with a reason
//   GET  /events/:slug                   the public page. No account.
//   POST /events/:slug                   the public RSVP. No account.
//
// Every decision lives in lib/sonara-growth-events.cjs. This file reads, writes
// and renders. It does not work out whether somebody has a seat, because a page
// that asks and then prints "You're confirmed" regardless is a gate that was never
// there.
//
// ## Two surfaces with different rules, in one file on purpose
//
// The owner pages are behind requireWorkspaceAccess("growth_studio"). The public
// pages are open to the internet. Keeping them together means the one place that
// decides what a stranger may see -- `publicSummary`, which returns counts and
// carries no attendee field at all -- is next to the handler that renders it,
// rather than two files apart where the next person adds a name to a template.
//
// ## What the public page never shows
//
// Names and email addresses. Who said they are coming is the organization's
// record. A page listing attendees turns an RSVP into a disclosure nobody agreed
// to; listing their email addresses turns it into a leak. The public handler reads
// RSVP rows only to count seats, and the object it renders from is built by
// `publicSummary`, which has no name or email field by construction.
//
// ## What nothing here does
//
// Sends anything. AGENTS.md: alerts are off or explicitly user-controlled by
// default. An RSVP is recorded and nobody is messaged -- no email, no SMS, no
// push. Takes money: an RSVP is not a ticket, and the migration asserts against
// the live catalogue that no column here can hold a price or a card.

const events = require("../lib/sonara-growth-events.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireWorkspaceAccess", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter"
];

const VENUE_TABLE = "growth_venues";
const EVENT_TABLE = "growth_events";
const RSVP_TABLE = "growth_event_rsvps";

// Read one past each cap so a truncated list is visible rather than looking short.
// An owner told "you have forty coming" when they have four hundred has been given
// a figure, and the figure is wrong in the direction that empties a room.
const VENUE_CAP = 200;
const EVENT_CAP = 200;
const RSVP_CAP = 1000;

function registerGrowthEventRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerGrowthEventRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireWorkspaceAccess, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders, createRateLimiter
  } = deps;

  const enc = encodeURIComponent;
  const OWNER_PAGE = "/growth-studio/owner/events";
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

  async function rest(config, path, init = {}) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: { ...supabaseHeaders(config), ...(init.headers || {}) }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const body = await response.json().catch(() => null);
    return { ok: Array.isArray(body), rows: Array.isArray(body) ? body : [], status: response.status };
  }

  async function write(config, path, payload, method = "POST") {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok), status: response?.status || 0 };
  }

  // The row shapes the pure module expects, done once here so it never has to
  // know what PostgREST calls a column.
  const toRsvp = (row) => ({
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    email: row.email,
    attending: row.attending,
    partySize: row.party_size,
    state: row.state,
    note: row.note
  });

  // ---------------------------------------------------------------------------
  // The owner's view
  // ---------------------------------------------------------------------------

  app.get(OWNER_PAGE, guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) {
      return res.status(503).type("html").send(layout({
        title: "Your events",
        eyebrow: "Growth Studio",
        heading: "Your events",
        body: "We could not reach your workspace just now. This is a problem on our side, and it is not telling you that you have no events.",
        sections: [],
        actions: [linkAction("/growth-studio", "Growth Studio")]
      }));
    }

    const orgFilter = `organization_id=eq.${enc(scope.organizationId)}`;
    const venues = await rest(scope.config,
      `${VENUE_TABLE}?select=id,name,address,capacity,time_zone&${orgFilter}&order=created_at.desc&limit=${VENUE_CAP + 1}`);
    const list = await rest(scope.config,
      `${EVENT_TABLE}?select=id,venue_id,title,summary,kind,status,starts_at,ends_at,capacity,slug,cancellation_reason&${orgFilter}&order=starts_at.desc&limit=${EVENT_CAP + 1}`);
    const rsvps = await rest(scope.config,
      `${RSVP_TABLE}?select=id,event_id,display_name,email,attending,party_size,state,note&${orgFilter}&order=created_at.asc&limit=${RSVP_CAP + 1}`);

    // A failed read renders as a failed read. An empty page here is a sentence:
    // it says you have no events.
    if (!venues.ok || !list.ok || !rsvps.ok) {
      return res.status(200).type("html").send(layout({
        title: "Your events",
        eyebrow: "Growth Studio",
        heading: "Your events",
        body: "We could not read part of your events just now. Nothing has changed, and this is not a list of your events -- try again shortly.",
        sections: [],
        actions: [linkAction("/growth-studio", "Growth Studio")]
      }));
    }

    const venueRows = venues.rows.slice(0, VENUE_CAP);
    const venueById = new Map(venueRows.map((venue) => [venue.id, venue]));
    const rsvpRows = rsvps.rows.slice(0, RSVP_CAP).map(toRsvp);
    const rsvpsByEvent = new Map();
    for (const rsvp of rsvpRows) {
      if (!rsvp.eventId) continue;
      if (!rsvpsByEvent.has(rsvp.eventId)) rsvpsByEvent.set(rsvp.eventId, []);
      rsvpsByEvent.get(rsvp.eventId).push(rsvp);
    }

    const sections = [];
    const notice = noticeFor(req.query);
    if (notice) sections.push(brandCard("What just happened", escapeHtml(notice)));

    for (const event of list.rows.slice(0, EVENT_CAP)) {
      const venue = event.venue_id ? venueById.get(event.venue_id) || null : null;
      const own = rsvpsByEvent.get(event.id) || [];
      const limit = events.capacityFor(event, venue);
      const taken = events.seatsTaken(own);
      const window = events.rsvpWindow(event);

      // Three states shown as three, never two. "Nobody has answered" is a
      // different line from "not coming", and an owner planning a room needs both.
      const going = own.filter((rsvp) => events.attendanceOf(rsvp) === events.ATTENDANCE.going).length;
      const notGoing = own.filter((rsvp) => events.attendanceOf(rsvp) === events.ATTENDANCE.not_going).length;
      const unanswered = own.filter((rsvp) => events.attendanceOf(rsvp) === events.ATTENDANCE.not_answered).length;

      const lines = [
        `<p>${escapeHtml(window.sentence)}</p>`,
        `<p>${escapeHtml(limit.reason)}</p>`,
        `<p>${escapeHtml(taken.ok ? taken.reason : "We could not count who is coming.")}</p>`,
        `<p>${going} said they are coming, ${notGoing} said they are not, and ${unanswered} have not answered.</p>`,
        venue ? `<p>At ${escapeHtml(venue.name)}${venue.address ? `, ${escapeHtml(venue.address)}` : ""}.</p>` : "<p>No venue attached.</p>",
        event.slug ? `<p>Public page: /events/${escapeHtml(event.slug)}</p>` : "<p>No web address yet, so it cannot be published.</p>"
      ];

      // The owner's own list, with email addresses, because this is their record.
      // The public page below shows none of this.
      if (own.length) {
        lines.push(
          "<ul>" + own.slice(0, 50).map((rsvp) =>
            `<li>${escapeHtml(rsvp.displayName)} (${escapeHtml(rsvp.email)}) — ${escapeHtml(rsvp.state)}, `
            + `${escapeHtml(String(rsvp.partySize))} ${rsvp.partySize === 1 ? "place" : "places"}, `
            + `${escapeHtml(events.attendanceOf(rsvp).replace(/_/g, " "))}</li>`).join("")
          + "</ul>"
        );
        if (own.length > 50) lines.push(`<p>Showing the first 50 of ${own.length}.</p>`);
      }

      if (event.status !== "cancelled") {
        lines.push(event.status === "published" ? cancelForm(event) : publishForm(event));
      }

      sections.push(brandCard(`${event.title || "Untitled event"} (${event.status})`, lines.join("")));
    }

    if (!list.rows.length) {
      sections.push(brandCard("No events yet", "Add a venue if you have one, then add an event. Nothing is public until you publish it."));
    }

    if (venueRows.length) {
      sections.push(brandCard(
        `Your venues (${venueRows.length})`,
        "<ul>" + venueRows.map((venue) =>
          `<li>${escapeHtml(venue.name)} — ${venue.capacity === null || venue.capacity === undefined
            ? "no capacity recorded"
            : `holds ${escapeHtml(String(venue.capacity))}`}, ${escapeHtml(venue.time_zone || "UTC")}</li>`).join("") + "</ul>"
      ));
    }

    sections.push(brandCard("Add a venue", venueForm()));
    sections.push(brandCard("Add an event", eventForm(venueRows)));

    return res.status(200).type("html").send(layout({
      title: "Your events",
      eyebrow: "Growth Studio",
      heading: "Your events",
      body: "Every event, how many places are taken, and who has said they are coming. Nothing is public until you publish it, and nobody is emailed by this page.",
      sections,
      actions: [linkAction("/growth-studio", "Growth Studio")]
    }));
  });

  // ---------------------------------------------------------------------------
  // The forms
  // ---------------------------------------------------------------------------

  const option = (value, selected) =>
    `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(value.replace(/_/g, " "))}</option>`;

  const venueForm = () => `
    <form action="/api/growth/venues" method="post">
      <label for="venue-name">What is this place called?</label>
      <input id="venue-name" name="name" type="text" maxlength="${events.TITLE_MAX}" required>
      <label for="venue-address">Address</label>
      <input id="venue-address" name="address" type="text" maxlength="${events.NOTE_MAX}">
      <label for="venue-capacity">How many does it hold? Leave empty if you do not know</label>
      <input id="venue-capacity" name="capacity" type="text" inputmode="numeric">
      <label for="venue-zone">Time zone</label>
      <input id="venue-zone" name="time_zone" type="text" value="UTC" maxlength="64">
      <button type="submit">Add this venue</button>
    </form>`;

  const eventForm = (venueRows) => `
    <form action="/api/growth/events" method="post">
      <label for="event-title">What is happening?</label>
      <input id="event-title" name="title" type="text" maxlength="${events.TITLE_MAX}" required>
      <label for="event-summary">Anything people should know</label>
      <textarea id="event-summary" name="summary" maxlength="${events.NOTE_MAX}" rows="3"></textarea>
      <label for="event-kind">What kind of thing is it?</label>
      <select id="event-kind" name="kind">${events.EVENT_KINDS.map((kind) => option(kind, "event")).join("")}</select>
      <label for="event-starts">When does it start?</label>
      <input id="event-starts" name="starts_at" type="datetime-local" required>
      <label for="event-ends">When does it end? Leave empty if it does not</label>
      <input id="event-ends" name="ends_at" type="datetime-local">
      <label for="event-venue">Where?</label>
      <select id="event-venue" name="venue_id">
        <option value="">Nowhere — it is online, or it is an announcement</option>
        ${venueRows.map((venue) => `<option value="${escapeHtml(venue.id)}">${escapeHtml(venue.name)}</option>`).join("")}
      </select>
      <label for="event-capacity">How many can come? Leave empty to use the venue's, or to record none</label>
      <input id="event-capacity" name="capacity" type="text" inputmode="numeric">
      <button type="submit">Add this event</button>
    </form>`;

  const publishForm = (event) => `
    <form action="/api/growth/events/publish" method="post">
      <input type="hidden" name="event_id" value="${escapeHtml(event.id)}">
      <label for="slug-${escapeHtml(event.id)}">The web address people will use: /events/…</label>
      <input id="slug-${escapeHtml(event.id)}" name="slug" type="text" value="${escapeHtml(event.slug || "")}" maxlength="48" required>
      <button type="submit">Publish this event</button>
    </form>`;

  const cancelForm = (event) => `
    <form action="/api/growth/events/cancel" method="post">
      <input type="hidden" name="event_id" value="${escapeHtml(event.id)}">
      <label for="why-${escapeHtml(event.id)}">Why is it cancelled? Everyone who booked will read this</label>
      <input id="why-${escapeHtml(event.id)}" name="reason" type="text" maxlength="${events.NOTE_MAX}" required>
      <button type="submit">Cancel this event</button>
    </form>`;

  // Codes in the URL, sentences looked up here. A sentence round-tripped through a
  // query string lets a crafted link put plausible text in this product's own
  // voice on an authenticated page.
  const DONE_SENTENCES = Object.freeze({
    venue: "That venue is saved.",
    event: "That event is saved. It is a draft until you publish it.",
    published: "That event is published and its page is live.",
    cancelled: "That event is cancelled. Its page still answers, and it says so."
  });
  const noticeFor = (query) => {
    const done = DONE_SENTENCES[String(query?.done || "")];
    if (done) return done;
    return events.problemSentence(String(query?.problem || "")) || null;
  };
  const back = (params) => `${OWNER_PAGE}?${new URLSearchParams(params).toString()}`;

  // ---------------------------------------------------------------------------
  // Owner writes
  // ---------------------------------------------------------------------------

  app.post("/api/growth/venues", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const name = String(req.body?.name || "").trim();
    if (!name || name.length > events.TITLE_MAX) return res.redirect(303, back({ problem: "title_missing" }));

    // An empty capacity box stays empty. Writing 0 here would turn "I do not know"
    // into "it holds nobody", which is the one conversion this whole feature is
    // built to refuse.
    const capacityRaw = String(req.body?.capacity ?? "").trim();
    let capacity = null;
    if (capacityRaw) {
      capacity = Number(capacityRaw);
      if (!Number.isInteger(capacity) || capacity < 0) return res.redirect(303, back({ problem: "capacity_unusable" }));
    }

    const written = await write(scope.config, VENUE_TABLE, {
      organization_id: scope.organizationId,
      name,
      address: String(req.body?.address || "").trim().slice(0, events.NOTE_MAX) || null,
      capacity,
      time_zone: String(req.body?.time_zone || "UTC").trim().slice(0, 64) || "UTC",
      created_by: scope.userId
    });
    return res.redirect(303, back(written.ok ? { done: "venue" } : { problem: "save_failed" }));
  });

  app.post("/api/growth/events", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const normalized = events.normalizeEvent(req.body || {});
    if (!normalized.ok) return res.redirect(303, back({ problem: normalized.problems[0] }));

    // A venue id has to be this organization's. Checked rather than assumed,
    // because the service-role key bypasses row level security and an id alone is
    // not an authorization.
    const venueId = String(req.body?.venue_id || "").trim();
    if (venueId) {
      const owned = await rest(scope.config,
        `${VENUE_TABLE}?select=id&id=eq.${enc(venueId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
      if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "venue_missing" }));
    }

    const written = await write(scope.config, EVENT_TABLE, {
      organization_id: scope.organizationId,
      venue_id: venueId || null,
      title: normalized.event.title,
      summary: normalized.event.summary,
      kind: normalized.event.kind,
      // Draft, always. Publishing is its own action with its own form, because
      // putting something on a public URL is not a side effect of saving a draft.
      status: "draft",
      starts_at: normalized.event.startsAt,
      ends_at: normalized.event.endsAt,
      capacity: normalized.event.capacity,
      slug: normalized.event.slug,
      created_by: scope.userId
    });
    return res.redirect(303, back(written.ok ? { done: "event" } : { problem: "save_failed" }));
  });

  app.post("/api/growth/events/publish", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const eventId = String(req.body?.event_id || "").trim();
    const slug = String(req.body?.slug || "").trim().toLowerCase();
    if (!eventId) return res.redirect(303, back({ problem: "event_missing" }));
    if (!slug) return res.redirect(303, back({ problem: "publish_needs_slug" }));
    if (!events.SLUG_PATTERN.test(slug)) return res.redirect(303, back({ problem: "slug_shape" }));

    const owned = await rest(scope.config,
      `${EVENT_TABLE}?select=id&id=eq.${enc(eventId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "event_missing" }));

    // Somebody else may hold this address. The unique index would refuse the write
    // anyway; this turns that into a sentence rather than a failed save with no
    // explanation.
    const taken = await rest(scope.config, `${EVENT_TABLE}?select=id&slug=eq.${enc(slug)}&limit=1`);
    if (!taken.ok) return res.redirect(303, back({ problem: "save_failed" }));
    if (taken.rows.length && taken.rows[0].id !== eventId) return res.redirect(303, back({ problem: "slug_taken" }));

    const patched = await write(
      scope.config,
      `${EVENT_TABLE}?id=eq.${enc(eventId)}&organization_id=eq.${enc(scope.organizationId)}`,
      { slug, status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      "PATCH"
    );
    return res.redirect(303, back(patched.ok ? { done: "published" } : { problem: "save_failed" }));
  });

  app.post("/api/growth/events/cancel", guard, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const eventId = String(req.body?.event_id || "").trim();
    const reason = String(req.body?.reason || "").trim().slice(0, events.NOTE_MAX);
    if (!eventId) return res.redirect(303, back({ problem: "event_missing" }));

    const owned = await rest(scope.config,
      `${EVENT_TABLE}?select=id&id=eq.${enc(eventId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "event_missing" }));

    // Cancelled, not deleted, and the slug is kept. Somebody holding an RSVP opens
    // the page they were given and is told; a 404 tells them nothing.
    const patched = await write(
      scope.config,
      `${EVENT_TABLE}?id=eq.${enc(eventId)}&organization_id=eq.${enc(scope.organizationId)}`,
      {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString()
      },
      "PATCH"
    );
    return res.redirect(303, back(patched.ok ? { done: "cancelled" } : { problem: "save_failed" }));
  });

  // ---------------------------------------------------------------------------
  // The public page
  // ---------------------------------------------------------------------------

  const publicPage = ({ heading, body, sections = [], status = 200 }) => ({
    status,
    html: layout({
      title: heading,
      eyebrow: "Event",
      heading,
      body,
      sections,
      actions: [linkAction("/", "SONARA One")]
    })
  });

  const notFound = (res) => {
    const page = publicPage({
      heading: "No such event",
      body: "This address does not match a published event. It may never have been published, or the organiser may have changed it.",
      status: 404
    });
    return res.status(page.status).type("html").send(page.html);
  };

  const unavailable = (res) => {
    const page = publicPage({
      heading: "We cannot reach this just now",
      body: "This is a problem on our side rather than anything to do with the event. Nothing has changed -- try again shortly.",
      status: 503
    });
    return res.status(page.status).type("html").send(page.html);
  };

  // One published event by slug, with its venue. `status=neq.draft` rather than
  // `status=eq.published`: a cancelled event has to stay readable, because the
  // person who booked needs to be told, and a 404 tells them nothing.
  async function findPublicEvent(config, slug) {
    const found = await rest(config,
      `${EVENT_TABLE}?select=id,organization_id,venue_id,title,summary,kind,status,starts_at,ends_at,capacity,slug,cancellation_reason`
      + `&slug=eq.${enc(slug)}&status=neq.draft&limit=1`);
    if (!found.ok) return { ok: false, event: null };
    const event = found.rows[0] || null;
    if (!event) return { ok: true, event: null };

    let venue = null;
    if (event.venue_id) {
      // Scoped by the event's organization as well as by id. The id alone was
      // enough to render another tenant's venue name and address on a public
      // page if venue_id ever pointed across the boundary, and
      // report-tenant-scoped-queries.mjs named it -- the organization was in hand
      // and simply not used.
      const venues = await rest(config,
        `${VENUE_TABLE}?select=id,name,address,capacity,time_zone&id=eq.${enc(event.venue_id)}`
        + `&organization_id=eq.${enc(event.organization_id)}&limit=1`);
      if (!venues.ok) return { ok: false, event: null };
      venue = venues.rows[0] || null;
    }
    return { ok: true, event, venue };
  }

  // Counts only. `select=party_size,state` and nothing else -- not display_name,
  // not email. A public handler that selected them would have them in memory one
  // template change away from being printed, and the cheapest way to never leak a
  // field is to never fetch it.
  async function publicRsvps(config, event) {
    // Scoped by organization as well as by event. The event id alone would have
    // been correct, since an RSVP cannot belong to two events -- but "correct
    // because of a property somewhere else" is how a cross-tenant read survives a
    // refactor, and the filter costs nothing.
    const rows = await rest(config,
      `${RSVP_TABLE}?select=party_size,state&event_id=eq.${enc(event.id)}`
      + `&organization_id=eq.${enc(event.organization_id)}&limit=${RSVP_CAP}`);
    if (!rows.ok) return { ok: false, rows: null };
    return { ok: true, rows: rows.rows.map((row) => ({ partySize: row.party_size, state: row.state })) };
  }

  const rsvpForm = (slug) => `
    <form action="/events/${escapeHtml(slug)}" method="post">
      <label for="rsvp-name">Your name</label>
      <input id="rsvp-name" name="display_name" type="text" maxlength="${events.TITLE_MAX}" required>
      <label for="rsvp-email">Your email, so the organiser can reach you</label>
      <input id="rsvp-email" name="email" type="email" maxlength="320" required>
      <label for="rsvp-party">How many of you are coming?</label>
      <input id="rsvp-party" name="party_size" type="number" min="1" max="${events.PARTY_MAX}" value="1">
      <fieldset>
        <legend>Are you coming?</legend>
        <label><input type="radio" name="attending" value="true"> Yes</label>
        <label><input type="radio" name="attending" value="false"> No, but keep me posted</label>
        <label><input type="radio" name="attending" value="" checked> Not sure yet</label>
      </fieldset>
      <label for="rsvp-note">Anything the organiser should know</label>
      <input id="rsvp-note" name="note" type="text" maxlength="${events.NOTE_MAX}">
      <button type="submit">Put my name down</button>
    </form>`;

  function eventSections({ event, venue, summary, slug, showForm }) {
    const sections = [
      brandCard("When", escapeHtml(new Date(event.starts_at).toUTCString() + (event.ends_at ? ` until ${new Date(event.ends_at).toUTCString()}` : ""))),
      brandCard("Where", venue
        ? escapeHtml(`${venue.name}${venue.address ? `, ${venue.address}` : ""}`)
        : "Not at a venue — this is online, or it is an announcement."),
      brandCard("How many are coming", `${escapeHtml(summary.countSentence)} ${escapeHtml(summary.capacitySentence)}`)
    ];
    if (showForm) sections.push(brandCard("Put your name down", rsvpForm(slug)));
    else sections.push(brandCard("Not taking names", escapeHtml(summary.statusSentence)));
    // Said on every public event page, because it is the thing a visitor would
    // otherwise assume either way.
    sections.push(brandCard(
      "What happens to what you type",
      "Your name and email go to the organiser so they can reach you about this event. Nothing is sent to you by us, and nobody else booked for this event can see your details."
    ));
    return sections;
  }

  app.get("/events/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!events.SLUG_PATTERN.test(slug)) return notFound(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPublicEvent(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.event) return notFound(res);

    const rsvps = await publicRsvps(config, found.event);
    const summary = events.publicSummary({ event: found.event, venue: found.venue, rsvps: rsvps.ok ? rsvps.rows : null });

    const page = publicPage({
      heading: found.event.title || "An event",
      body: String(found.event.summary || "").trim() || "No description was recorded for this event.",
      sections: eventSections({
        event: found.event,
        venue: found.venue,
        summary,
        slug,
        // A form is offered only when the event is taking names AND we could read
        // the count. Offering it when the count is unreadable would mean the next
        // press is refused with "we could not read who is coming", which is a
        // worse experience than being told so up front.
        showForm: summary.open && summary.ok
      })
    });
    return res.status(page.status).type("html").send(page.html);
  });

  // Five an hour from one address. An RSVP form is a write endpoint open to the
  // internet; the ceiling is where a real person booking for their family stays
  // under it and a script does not. Same figure as the public booking form, which
  // is the same shape of risk.
  const rsvpLimiter = createRateLimiter({
    name: "public_event_rsvp",
    windowSeconds: 3600,
    maxAttempts: 5,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.post("/events/:slug", rsvpLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!events.SLUG_PATTERN.test(slug)) return notFound(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPublicEvent(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.event) return notFound(res);

    const normalized = events.normalizeRsvp(req.body || {});
    if (!normalized.ok) {
      const page = publicPage({
        heading: found.event.title || "An event",
        body: events.problemSentence(normalized.problems[0]) || "We could not read what you typed.",
        sections: [brandCard("Try again", rsvpForm(slug))],
        status: 400
      });
      return res.status(page.status).type("html").send(page.html);
    }

    const rsvps = await publicRsvps(config, found.event);
    const decision = events.admit({
      event: found.event,
      venue: found.venue,
      rsvps: rsvps.ok ? rsvps.rows : null,
      partySize: normalized.rsvp.partySize
    });

    if (decision.outcome === events.ADMISSION.refused) {
      const page = publicPage({
        heading: found.event.title || "An event",
        body: decision.sentence,
        sections: [],
        // A refusal because the event is closed is the event's state, not a bad
        // request; a refusal because we could not read the count is ours.
        status: decision.code === "attendance_unreadable" ? 503 : 409
      });
      return res.status(page.status).type("html").send(page.html);
    }

    // `confirmed` and `waitlisted` are the only two states the schema stores. The
    // capacity-not-recorded case is stored as confirmed because the seat is as
    // good as any other at this event -- what differs is what the person is told,
    // and that is decision.sentence rather than a third row state nobody could
    // act on.
    const state = decision.outcome === events.ADMISSION.waitlisted ? "waitlisted" : "confirmed";

    const written = await fetch(`${config.url}/rest/v1/${RSVP_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id: found.event.organization_id,
        event_id: found.event.id,
        display_name: normalized.rsvp.displayName,
        email: normalized.rsvp.email,
        // Three states all the way to the column. "Not sure yet" is written as
        // null, never defaulted to false.
        attending: normalized.rsvp.attending,
        party_size: normalized.rsvp.partySize,
        state,
        note: normalized.rsvp.note
      })
    }).catch(() => undefined);

    if (!written?.ok) {
      // 409 from the unique index means this person already has a booking. Told as
      // that rather than as a failure, because a double submission is the most
      // likely cause and "it did not save" would make them try again.
      const already = written?.status === 409;
      const page = publicPage({
        heading: found.event.title || "An event",
        body: already
          ? events.problemSentence("already_rsvped")
          : "That did not save. Nothing has changed, and it is worth trying again shortly.",
        sections: [],
        status: already ? 409 : 503
      });
      return res.status(page.status).type("html").send(page.html);
    }

    const page = publicPage({
      heading: found.event.title || "An event",
      body: decision.sentence,
      sections: [brandCard(
        "What happens next",
        "The organiser has your name and email. We do not email you about this -- if they want to reach you, they will."
      )]
    });
    return res.status(page.status).type("html").send(page.html);
  });
}

module.exports = registerGrowthEventRoutes;
