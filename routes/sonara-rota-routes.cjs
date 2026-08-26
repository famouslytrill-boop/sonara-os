"use strict";

// The week the rota actually covers.
//
//   GET /business-builder/owner/schedules/week
//
// /business-builder/owner/schedules already lists shifts, which answers "what
// have I entered" and not "who is on next Tuesday". That was a convenience gap
// until the public booking page shipped; it is now a correctness one.
//
// **A staffed booking page only offers a slot when somebody is rostered for the
// whole of it.** So a business that ticked "book a member of staff" and then
// left a Tuesday empty has a page quietly showing that Tuesday as unavailable,
// and no screen anywhere said so. The coverage half of this page is the fix.
//
// The opening hours come from public_booking_pages, which is where a business
// records when it is open. A business with no booking page gets the rota
// without the coverage, and the page says so rather than showing an empty gap
// list -- "nothing missing" and "nothing to compare against" are the same
// screen otherwise, and one of them is a promise.

const { layOutWeek, weekStartFor, shiftWeek, hoursAndMinutes, isoDayParts } = require("../lib/sonara-rota-week.cjs");

const SCHEDULES_TABLE = "employee_schedules";
const STAFF_TABLE = "business_employee_profiles";
const BOOKING_PAGE_TABLE = "public_booking_pages";

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders"
];

function registerRotaRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerRotaRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;
  const PAGE = "/business-builder/owner/schedules/week";

  function htmlCard(title, inner) {
    return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2>${inner}</article>`;
  }

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId };
  }

  async function rest(config, path) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? { ok: true, rows } : { ok: false, rows: [] };
  }

  app.get(PAGE, requireBusinessManager, async (req, res) => {
    const back = [
      linkAction("/business-builder/owner/schedules", "Add or edit shifts"),
      linkAction("/business-builder/dashboard", "Back to your workspace")
    ];
    const page = (sections, status = 200) => res.status(status).type("html").send(layout({
      title: "Who is working this week", eyebrow: "Business Builder", heading: "Who is working this week",
      body: "Your rota as a week, and the hours you are open with nobody on.",
      sections, actions: back
    }));

    const scope = await scopeFor(req);
    if (!scope) return page([brandCard("Your workspace could not be read", "This page cannot say who is working. It is not saying nobody is.")], 503);

    // The booking page carries both the zone the business works in and when it
    // says it is open. Read first, because the zone decides which shifts fall
    // on which day and a week laid out in the wrong zone is wrong everywhere.
    const bookingPage = await rest(scope.config, `${BOOKING_PAGE_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=time_zone,opening_hours,enabled,assign_staff&limit=1`);
    const settings = bookingPage.ok ? (bookingPage.rows[0] || null) : null;
    const timeZone = settings?.time_zone || "UTC";

    // A week from the query only if it is a real date. isoDayParts refuses
    // "2026-13-40", which Date.UTC would roll over into February 2027.
    const requested = isoDayParts(req.query?.week) ? String(req.query.week) : null;
    const weekStartsOn = requested || weekStartFor(new Date(), timeZone);
    if (!weekStartsOn) return page([brandCard("We could not work out which week to show", "The time zone on your booking page is not one this server recognises, so a week cannot be laid out.")]);

    const anchor = Date.parse(`${weekStartsOn}T00:00:00Z`);
    const [shifts, staff] = await Promise.all([
      // Windowed on overlap rather than on starts_at, so a shift that began
      // before Monday and runs into the week is still found -- the same
      // correction the booking reads needed.
      rest(scope.config, `${SCHEDULES_TABLE}?organization_id=eq.${enc(scope.organizationId)}`
        + `&starts_at=lte.${enc(new Date(anchor + 9 * 86400000).toISOString())}`
        + `&ends_at=gte.${enc(new Date(anchor - 2 * 86400000).toISOString())}`
        + `&select=id,employee_id,starts_at,ends_at,status,role_label&limit=1000`),
      rest(scope.config, `${STAFF_TABLE}?organization_id=eq.${enc(scope.organizationId)}&select=id,display_name&limit=500`)
    ]);

    if (!shifts.ok) {
      // Never an empty week. "Nobody is working" is the most alarming way for
      // this page to be wrong, and a business would go and re-enter a rota it
      // already has.
      return page([brandCard(
        "We could not read your rota",
        "This page cannot tell you who is working. It is not saying nobody is -- do not re-enter shifts from here."
      )], 503);
    }

    const names = new Map(staff.ok ? staff.rows.map((row) => [row.id, row.display_name]) : []);
    const week = layOutWeek({
      shifts: shifts.rows,
      weekStartsOn,
      timeZone,
      // Only when the business has actually said when it is open. Passing an
      // absent value would compute gaps against nothing and report none.
      openingHours: settings?.opening_hours || null,
      names
    });
    if (!week.ok) return page([brandCard("We could not lay out this week", week.reason)]);

    const sections = [];
    const previous = shiftWeek(weekStartsOn, -1, timeZone);
    const next = shiftWeek(weekStartsOn, 1, timeZone);
    sections.push(htmlCard("Week", `
      <p><strong>${escapeHtml(weekStartsOn)}</strong> to <strong>${escapeHtml(week.days[week.days.length - 1]?.date || weekStartsOn)}</strong>, shown in ${escapeHtml(week.timeZone)}.</p>
      <p class="card-actions">
        ${previous ? `<a class="action" href="${PAGE}?week=${escapeHtml(previous)}">Previous week</a>` : ""}
        <a class="action" href="${PAGE}">This week</a>
        ${next ? `<a class="action" href="${PAGE}?week=${escapeHtml(next)}">Next week</a>` : ""}
      </p>
      <p>${escapeHtml(hoursAndMinutes(week.staffedMinutes))} rostered across ${week.people} ${week.people === 1 ? "person" : "people"}.</p>`));

    if (!staff.ok) {
      sections.push(brandCard("We could not read your staff list", "The shifts below are shown without names. Nothing is missing from the rota itself."));
    }
    if (week.unreadable > 0) {
      // Counted rather than dropped: a shift somebody entered that this cannot
      // read is cover the business believes it has.
      sections.push(brandCard(
        `${week.unreadable} ${week.unreadable === 1 ? "shift is" : "shifts are"} not shown`,
        "They have no end time, or they end before they start. They are not counted as cover anywhere, including on your booking page. Open your schedule to fix them."
      ));
    }

    sections.push(week.days.map((day) => {
      const rows = day.shifts.length
        ? `<ul class="sonara-rota-day">${day.shifts.map((shift) => `<li>
            <strong>${escapeHtml(shift.who || "Somebody no longer on your staff list")}</strong>
            ${escapeHtml(shift.from)}–${escapeHtml(shift.to)}
            ${shift.label ? ` · ${escapeHtml(shift.label)}` : ""}
            ${shift.continuesFromPrevious ? " · from the night before" : ""}${shift.continuesIntoNext ? " · runs past midnight" : ""}
          </li>`).join("")}</ul>`
        : `<p class="fine">Nobody is on.</p>`;
      const gaps = day.gaps === null
        ? ""
        : (day.gaps.length
          ? `<p class="sonara-rota-gap"><strong>Open with nobody on:</strong> ${day.gaps.map((gap) => escapeHtml(`${gap.from}–${gap.to}`)).join(", ")}</p>`
          : `<p class="fine">Covered for every hour you are open.</p>`);
      return `<article class="card sonara-depth" data-sonara-enter>
        <h2>${escapeHtml(day.weekday)} ${escapeHtml(day.date)}</h2>
        <p class="fine">${escapeHtml(hoursAndMinutes(day.staffedMinutes))}${day.peopleOnAtOnce > 1 ? ` · up to ${day.peopleOnAtOnce} at once` : ""}</p>
        ${rows}${gaps}
      </article>`;
    }).join(""));

    // The sentence this page exists for.
    if (week.gaps === null) {
      sections.push(brandCard(
        "Nothing to compare your rota against",
        bookingPage.ok
          ? "You have not set opening hours on a booking page, so this cannot say which hours are uncovered. It is not saying they all are."
          : "Your booking page settings could not be read, so this cannot say which hours are uncovered. It is not saying they all are."
      ));
    } else if (week.gaps.length && settings?.enabled && settings?.assign_staff) {
      sections.push(brandCard(
        "Your booking page is showing these hours as unavailable",
        "It is set to book a member of staff, so it only offers a time when somebody is rostered for the whole of it. The hours above with nobody on are hours a customer cannot book — and they do not read as closed, they read as full."
      ));
    } else if (!week.gaps.length) {
      sections.push(brandCard("Every hour you are open has somebody on it", "Across this whole week."));
    }

    return page(sections);
  });
}

registerRotaRoutes.PAGE = "/business-builder/owner/schedules/week";

module.exports = registerRotaRoutes;
