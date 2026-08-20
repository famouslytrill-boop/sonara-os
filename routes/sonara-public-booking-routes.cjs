"use strict";

// A page a stranger can open to book an appointment, and the owner's settings
// for it.
//
//   GET  /book/:slug                          public, no account
//   POST /book/:slug                          public, rate limited, writes one booking
//   GET  /business-builder/owner/booking-page owner settings
//   POST /api/booking-page                    owner saves them
//
// The read resolves in one direction only, and that order is the safety.
//
// The slug finds exactly one enabled `public_booking_pages` row. That row names
// the organization. The services offered, the bookings that block a time, and
// the booking finally written are all filtered on that organization id. So the
// public page never chooses an organization -- it is told one by the row its
// owner published. A page that took the organization from the request would be
// a page that could be told the wrong one, and the service-role key bypasses
// row level security, so that filter is the only tenant boundary there is.
//
// ## What a visitor is never shown
//
// Only free times. Not "10:30 taken", not who took it. A stranger who could see
// which slots are booked could read a competitor's diary, and "unavailable" and
// "Mrs Patel, boiler service" are the same fact at different resolutions. The
// availability module is given the bookings and returns only what is left.
//
// ## Why the time is checked twice
//
// The list a visitor is looking at was computed when the page loaded. Somebody
// else may have taken the slot since. `isBookable` runs again on submit against
// a fresh read, and re-derives the whole grid rather than trusting the
// submitted time -- so a hand-made request cannot book 03:00 on a Sunday just
// because nothing is booked then.
//
// ## What this does not do
//
// It does not take a payment, and it does not confirm. A booking arrives as
// `requested`, which is the table's own default and the status the business
// then accepts or declines. Confirming on the visitor's behalf would be this
// application committing a business to work it has not seen.

const { availableSlots, isBookable, WEEKDAY_NAMES, normaliseOpeningHours, minutesFromClock, knownZone } = require("../lib/sonara-booking-availability.cjs");

const PAGES_TABLE = "public_booking_pages";
const BOOKINGS_TABLE = "business_bookings";
const CATALOG_TABLE = "business_service_catalog";

// Same shape as the CHECK constraint in the migration. Checked before the value
// reaches a PostgREST filter: an unchecked slug is interpolated into a query,
// and the empty string there matches rows whose slug is empty rather than none.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter"
];

function isEmailLike(value) {
  const text = String(value || "").trim();
  return text.length >= 3 && text.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function money(cents, currency = "usd") {
  const amount = Number(cents);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `${String(currency || "usd").toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

// What the owner typed, turned into the seven-entry column. Anything unreadable
// closes that day -- opening a business at a time it did not ask for puts a
// stranger on its doorstep.
function openingHoursFromForm(body) {
  return WEEKDAY_NAMES.map((_, index) => {
    if (String(body?.[`open_${index}`] ?? "") !== "on") return null;
    const open = minutesFromClock(body?.[`from_${index}`]);
    const close = minutesFromClock(body?.[`to_${index}`]);
    if (open === null || close === null || close <= open) return null;
    return { open: String(body[`from_${index}`]).trim(), close: String(body[`to_${index}`]).trim() };
  });
}

function registerPublicBookingRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerPublicBookingRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders, createRateLimiter
  } = deps;

  const enc = encodeURIComponent;

  async function rest(config, path) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? { ok: true, rows } : { ok: false, rows: [] };
  }

  // brandCard escapes its body, which is right for a sentence and wrong for a
  // form. Cards carrying markup are built here instead, in the same shape the
  // other route modules use, rather than by loosening brandCard for everybody.
  function htmlCard(title, inner) {
    return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2>${inner}</article>`;
  }

  function publicPage({ heading, body, sections = [] }) {
    return layout({
      title: heading, eyebrow: "SONARA One", heading, body, surface: "marketing",
      sections, actions: [linkAction("/", "SONARA One")]
    });
  }

  // The same page for "no such slug" and "switched off", on purpose. Telling
  // them apart tells somebody guessing addresses when they have guessed one
  // that exists.
  function noSuchPage(res) {
    return res.status(404).type("html").send(publicPage({
      heading: "That booking page is not open",
      body: "It may never have existed, or the business may have taken it down. Nothing here can tell the difference.",
      sections: [brandCard("If you were given this link", "Go back to whoever sent it and ask for a current one.")]
    }));
  }

  // A read that failed is not a business that does not exist. Saying "no such
  // page" to somebody holding a working link would have them tell the business
  // it was broken.
  function unavailable(res) {
    return res.status(503).type("html").send(publicPage({
      heading: "We could not open that just now",
      body: "This is on our side and the page has not been removed. Try again shortly.",
      sections: []
    }));
  }

  // The published page for a slug, or null. Only `enabled` rows resolve, so
  // reserving a slug does not publish it.
  async function findPage(config, slug) {
    const path = `${PAGES_TABLE}?slug=eq.${enc(slug)}&enabled=is.true&select=id,organization_id,slug,headline,intro,time_zone,opening_hours,slot_minutes,lead_time_hours,horizon_days&limit=1`;
    const result = await rest(config, path);
    if (!result.ok) return { ok: false, page: null };
    return { ok: true, page: result.rows[0] || null };
  }

  // What the business offers, priced and timed. A service with no duration is
  // not offered here: the availability module refuses to invent a length, and
  // showing a service that cannot produce a single time is worse than not
  // showing it.
  async function readServices(config, organizationId) {
    const path = `${CATALOG_TABLE}?organization_id=eq.${enc(organizationId)}&status=eq.active&select=id,name,description,duration_minutes,price_cents,currency&order=name.asc&limit=100`;
    const result = await rest(config, path);
    if (!result.ok) return { ok: false, rows: [] };
    return { ok: true, rows: result.rows.filter((row) => Number.isInteger(Number(row.duration_minutes)) && Number(row.duration_minutes) > 0) };
  }

  // The appointments that block a time, over the window the page can offer.
  //
  // Returns ok:false on a failed read, and every caller refuses rather than
  // continuing. An unreadable booking list treated as "nothing is booked" would
  // offer every slot in the diary to a stranger.
  async function readBookings(config, organizationId, horizonDays) {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + (Number(horizonDays) || 21) * 86400000 + 86400000).toISOString();
    const path = `${BOOKINGS_TABLE}?organization_id=eq.${enc(organizationId)}&starts_at=gte.${enc(from)}&starts_at=lte.${enc(to)}&select=starts_at,ends_at,status&limit=1000`;
    return rest(config, path);
  }

  function serviceCard(service, slug) {
    const price = money(service.price_cents, service.currency);
    return htmlCard(service.name || "A service", [
      `<p>${escapeHtml(String(service.description || "").slice(0, 240))}</p>`,
      `<p class="sonara-meta">${escapeHtml(String(service.duration_minutes))} minutes${price ? ` · ${escapeHtml(price)}` : ""}</p>`,
      `<p><a class="action" href="/book/${escapeHtml(slug)}?service=${escapeHtml(service.id)}">Choose a time</a></p>`
    ].join(""));
  }

  app.get("/book/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return noSuchPage(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPage(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.page) return noSuchPage(res);
    const page = found.page;

    const services = await readServices(config, page.organization_id);
    if (!services.ok) return unavailable(res);

    const heading = String(page.headline || "").trim() || "Book an appointment";
    const intro = String(page.intro || "").trim() || "Choose what you need and pick a time that suits you.";

    if (!services.rows.length) {
      return res.status(200).type("html").send(publicPage({
        heading,
        body: intro,
        sections: [brandCard("Nothing can be booked here yet", "This business has not published anything with a length set, so there is nothing to offer a time for.")]
      }));
    }

    const wanted = String(req.query?.service || "");
    if (!wanted) {
      return res.status(200).type("html").send(publicPage({
        heading, body: intro,
        sections: services.rows.map((service) => serviceCard(service, slug))
      }));
    }

    // The service must be one of this organization's. Matching against the list
    // already filtered by organization_id is the check -- an id from another
    // business finds nothing here rather than being fetched separately.
    const service = UUID_PATTERN.test(wanted) ? services.rows.find((row) => row.id === wanted) : null;
    if (!service) return res.redirect(303, `/book/${slug}`);

    const bookings = await readBookings(config, page.organization_id, page.horizon_days);
    if (!bookings.ok) return unavailable(res);

    const slots = availableSlots({ page, durationMinutes: service.duration_minutes, bookings: bookings.rows });
    if (!slots.ok || !slots.days.length) {
      return res.status(200).type("html").send(publicPage({
        heading, body: intro,
        sections: [
          brandCard(escapeHtml(service.name), escapeHtml(slots.reason || "No times are available.")),
          htmlCard("Try something else", `<p><a class="action" href="/book/${escapeHtml(slug)}">Back to what this business offers</a></p>`)
        ]
      }));
    }

    const problem = String(req.query?.problem || "");
    const problems = {
      taken: "That time was taken while you were filling the form in. Please pick another.",
      details: "Please give a name and either an email address or a phone number, so the business can confirm with you.",
      not_saved: "We could not save that just now. Nothing was booked -- please try again."
    };

    const dayBlocks = slots.days.map((day) => `
      <fieldset class="sonara-slot-day">
        <legend>${escapeHtml(day.weekday)} ${escapeHtml(day.date)}</legend>
        ${day.times.map((time) => `<label class="sonara-slot"><input type="radio" name="starts_at" value="${escapeHtml(time.startsAt)}" required> ${escapeHtml(time.localTime)}</label>`).join("")}
      </fieldset>`).join("");

    return res.status(200).type("html").send(publicPage({
      heading: `${heading} — ${escapeHtml(service.name)}`,
      body: `${escapeHtml(String(service.duration_minutes))} minutes. Times are shown in ${escapeHtml(slots.timeZone)}.`,
      sections: [
        problem && problems[problem] ? brandCard("Not booked", escapeHtml(problems[problem])) : "",
        htmlCard("Pick a time", `
          <form method="post" action="/book/${escapeHtml(slug)}" class="sonara-booking-form">
            <input type="hidden" name="service_id" value="${escapeHtml(service.id)}">
            ${dayBlocks}
            <label>Your name<input type="text" name="customer_name" maxlength="120" required autocomplete="name"></label>
            <label>Email<input type="email" name="customer_email" maxlength="320" autocomplete="email"></label>
            <label>Phone<input type="tel" name="customer_phone" maxlength="40" autocomplete="tel"></label>
            <label>Anything the business should know<textarea name="notes" maxlength="1000" rows="3"></textarea></label>
            <button type="submit">Request this appointment</button>
          </form>`),
        brandCard("What happens next", "The business receives this as a request and confirms it with you. Nothing is charged here, and this page never asks for card details.")
      ].filter(Boolean)
    }));
  });

  // Five requests an hour from one address. A booking form is a write endpoint
  // open to the internet, so the ceiling is set where a real person booking for
  // their family stays under it and a script does not.
  const bookingLimiter = createRateLimiter({
    name: "public_booking",
    windowSeconds: 3600,
    maxAttempts: 5,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.post("/book/:slug", bookingLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return noSuchPage(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const found = await findPage(config, slug);
    if (!found.ok) return unavailable(res);
    if (!found.page) return noSuchPage(res);
    const page = found.page;

    const serviceId = String(req.body?.service_id || "");
    const services = await readServices(config, page.organization_id);
    if (!services.ok) return unavailable(res);
    const service = UUID_PATTERN.test(serviceId) ? services.rows.find((row) => row.id === serviceId) : null;
    if (!service) return res.redirect(303, `/book/${slug}`);

    const name = String(req.body?.customer_name || "").trim().slice(0, 120);
    const email = String(req.body?.customer_email || "").trim().slice(0, 320);
    const phone = String(req.body?.customer_phone || "").trim().slice(0, 40);
    const back = `/book/${slug}?service=${enc(service.id)}`;
    // A name and one way to reach them. A booking the business cannot confirm
    // is a slot held for nobody.
    if (!name || (!isEmailLike(email) && phone.length < 5)) return res.redirect(303, `${back}&problem=details`);

    const bookings = await readBookings(config, page.organization_id, page.horizon_days);
    if (!bookings.ok) return unavailable(res);

    // Checked again, against a fresh read, and re-derived rather than trusted.
    const check = isBookable({
      page,
      durationMinutes: service.duration_minutes,
      bookings: bookings.rows,
      startsAt: String(req.body?.starts_at || "")
    });
    if (!check.ok) return res.redirect(303, `${back}&problem=taken`);

    const row = {
      // From the published page, never from the request.
      organization_id: page.organization_id,
      service_id: service.id,
      customer_name: name,
      customer_email: isEmailLike(email) ? email : null,
      customer_phone: phone || null,
      starts_at: check.startsAt,
      ends_at: check.endsAt,
      // The table's own default, and the honest one: the business has not seen
      // this yet. Writing `confirmed` would commit a business to work on the
      // word of a stranger.
      status: "requested",
      notes: String(req.body?.notes || "").trim().slice(0, 1000) || null
    };

    const saved = await fetch(`${config.url}/rest/v1/${BOOKINGS_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row)
    }).catch(() => undefined);
    if (!saved?.ok) return res.redirect(303, `${back}&problem=not_saved`);

    return res.status(200).type("html").send(publicPage({
      heading: "Requested",
      body: "The business has your request and will confirm it with you.",
      sections: [
        brandCard("What you asked for", `${escapeHtml(service.name)} — ${escapeHtml(new Date(check.startsAt).toISOString().replace("T", " ").slice(0, 16))} UTC`),
        brandCard("This is not confirmed yet", "A request is not an appointment until the business accepts it. Nothing has been charged and no card details were taken.")
      ]
    }));
  });

  // ---- The owner's side -----------------------------------------------------

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId, userId: user?.id || null };
  }

  app.get("/business-builder/owner/booking-page", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return res.status(503).type("html").send(layout({
        title: "Your booking page", eyebrow: "Business Builder", heading: "Your booking page",
        body: "Your workspace could not be read, so this page cannot say whether you have a booking page or what is on it.",
        sections: [], actions: [linkAction("/business-builder/dashboard", "Back to your workspace")]
      }));
    }

    const existing = await rest(scope.config, `${PAGES_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=slug,enabled,headline,intro,time_zone,opening_hours,slot_minutes,lead_time_hours,horizon_days&limit=1`);
    const row = existing.ok ? (existing.rows[0] || null) : null;
    const hours = normaliseOpeningHours(row?.opening_hours);
    const raw = Array.isArray(row?.opening_hours) ? row.opening_hours : [];

    const dayRows = WEEKDAY_NAMES.map((label, index) => {
      const open = hours[index].length > 0;
      const first = raw[index] && typeof raw[index] === "object" && !Array.isArray(raw[index]) ? raw[index] : null;
      return `<fieldset class="sonara-hours-day">
        <legend>${label}</legend>
        <label><input type="checkbox" name="open_${index}"${open ? " checked" : ""}> Open</label>
        <label>From <input type="time" name="from_${index}" value="${escapeHtml(String(first?.open || "09:00"))}"></label>
        <label>To <input type="time" name="to_${index}" value="${escapeHtml(String(first?.close || "17:00"))}"></label>
      </fieldset>`;
    }).join("");

    const sections = [];
    if (!existing.ok) {
      // Never rendered as "you have not set one up yet". That sentence would
      // invite an owner to create a second row over the top of the one they have.
      sections.push(brandCard("We could not read your settings", "This is a problem on our side. Nothing below is your saved configuration -- do not save over it until this page loads properly."));
    } else if (row?.slug && row.enabled) {
      sections.push(htmlCard("Your page is live", `<p>Anyone with this address can request an appointment.</p><p><a class="action" href="/book/${escapeHtml(row.slug)}">/book/${escapeHtml(row.slug)}</a></p>`));
    } else if (row?.slug) {
      sections.push(htmlCard("Your address is reserved and switched off", `<p>Nobody can open <code>/book/${escapeHtml(row.slug)}</code> until you tick &quot;Take bookings&quot;.</p>`));
    } else {
      sections.push(brandCard("You do not have a booking page yet", "Choose an address below. Nothing is public until you tick the box."));
    }

    sections.push(brandCard("What a visitor sees", "The services you have marked active that have a length in minutes, and the times you are free. Never who booked the other times, never your notes, and never anybody's contact details."));

    sections.push(htmlCard("Settings", `
      <form method="post" action="/api/booking-page" class="sonara-settings-form">
        <label>Address<span class="sonara-prefix">/book/</span><input type="text" name="slug" value="${escapeHtml(String(row?.slug || ""))}" maxlength="48" pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]" placeholder="your-business"></label>
        <label><input type="checkbox" name="enabled"${row?.enabled ? " checked" : ""}> Take bookings</label>
        <label>Headline<input type="text" name="headline" value="${escapeHtml(String(row?.headline || ""))}" maxlength="120"></label>
        <label>Intro<textarea name="intro" maxlength="400" rows="2">${escapeHtml(String(row?.intro || ""))}</textarea></label>
        <label>Time zone<input type="text" name="time_zone" value="${escapeHtml(String(row?.time_zone || "UTC"))}" maxlength="64" required></label>
        ${dayRows}
        <label>Slot length in minutes<input type="number" name="slot_minutes" min="5" max="240" value="${escapeHtml(String(row?.slot_minutes ?? 30))}"></label>
        <label>Earliest booking, hours from now<input type="number" name="lead_time_hours" min="0" max="720" value="${escapeHtml(String(row?.lead_time_hours ?? 12))}"></label>
        <label>How far ahead people can book, in days<input type="number" name="horizon_days" min="1" max="90" value="${escapeHtml(String(row?.horizon_days ?? 21))}"></label>
        <button type="submit">Save</button>
      </form>`));

    const problem = String(req.query?.problem || "");
    const problems = {
      slug_taken: "That address is already in use by another business. Choose a different one.",
      slug_shape: "An address can use lowercase letters, digits and hyphens, and must start and end with a letter or digit.",
      zone: "That is not a time zone this server recognises. Use a name like Europe/London or America/New_York.",
      no_hours: "You asked to take bookings and no day is open, so nobody could have booked anything.",
      not_saved: "We could not save that. Nothing was changed."
    };
    if (problems[problem]) sections.unshift(brandCard("Not saved", escapeHtml(problems[problem])));

    return res.status(200).type("html").send(layout({
      title: "Your booking page", eyebrow: "Business Builder", heading: "Your booking page",
      body: "One address a customer can open to ask for an appointment, without an account and without talking to you first.",
      sections, actions: [linkAction("/business-builder/dashboard", "Back to your workspace"), linkAction("/business-builder/owner/bookings", "Your bookings")]
    }));
  });

  app.post("/api/booking-page", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) return res.status(503).json({ ok: false, code: "setup_required" });
    const settings = "/business-builder/owner/booking-page";

    const slug = String(req.body?.slug || "").trim().toLowerCase();
    if (slug && !SLUG_PATTERN.test(slug)) return res.redirect(303, `${settings}?problem=slug_shape`);

    const zone = knownZone(req.body?.time_zone);
    if (!zone) return res.redirect(303, `${settings}?problem=zone`);

    const enabled = String(req.body?.enabled ?? "") === "on";
    const openingHours = openingHoursFromForm(req.body);
    // Switching a page on with no open day publishes an address that can never
    // produce a time. Refused here rather than rendered as an empty page a
    // visitor would read as this business being fully booked.
    if (enabled && !openingHours.some(Boolean)) return res.redirect(303, `${settings}?problem=no_hours`);
    // And an address is required to be public. Without one there is nothing to
    // switch on.
    if (enabled && !slug) return res.redirect(303, `${settings}?problem=slug_shape`);

    const clamp = (value, low, high, fallback) => {
      const parsed = Number.parseInt(String(value ?? ""), 10);
      return Number.isInteger(parsed) ? Math.min(high, Math.max(low, parsed)) : fallback;
    };

    const row = {
      organization_id: scope.organizationId,
      slug: slug || null,
      enabled,
      headline: String(req.body?.headline || "").trim().slice(0, 120) || null,
      intro: String(req.body?.intro || "").trim().slice(0, 400) || null,
      time_zone: zone,
      opening_hours: openingHours,
      slot_minutes: clamp(req.body?.slot_minutes, 5, 240, 30),
      lead_time_hours: clamp(req.body?.lead_time_hours, 0, 720, 12),
      horizon_days: clamp(req.body?.horizon_days, 1, 90, 21),
      created_by: scope.userId,
      updated_at: new Date().toISOString()
    };

    // One row per organization, enforced by a unique index, so this is an
    // upsert on that column rather than a read followed by an insert or update.
    // The read-then-write version has a race that produces a duplicate key
    // error the second time somebody saves from two tabs.
    const saved = await fetch(`${scope.config.url}/rest/v1/${PAGES_TABLE}?on_conflict=organization_id`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(scope.config),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(row)
    }).catch(() => undefined);

    if (!saved?.ok) {
      // 409 is the slug's unique index, which is the one failure an owner can
      // do something about. Everything else is ours.
      return res.redirect(303, `${settings}?problem=${saved?.status === 409 ? "slug_taken" : "not_saved"}`);
    }
    return res.redirect(303, settings);
  });
}

registerPublicBookingRoutes.SLUG_PATTERN = SLUG_PATTERN;
registerPublicBookingRoutes.openingHoursFromForm = openingHoursFromForm;
registerPublicBookingRoutes.isEmailLike = isEmailLike;

module.exports = registerPublicBookingRoutes;
