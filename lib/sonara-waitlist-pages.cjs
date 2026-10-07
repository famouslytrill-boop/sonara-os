// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The waiting list and the things a customer can book, as one page.
//
// routes/sonara-operations-expansion-routes.cjs stored both -- a waitlist entry
// is a business_bookings row marked `metadata.waitlist`, a bookable resource is
// a business_assets row marked `metadata.bookable` -- and nothing rendered
// either. tests/form-reachability.test.js excused the two save endpoints because
// "the reservation page consumes the saved resource rows". There was no
// reservation page. This is it.
//
// Offering an opening records that it was offered. It does not message the
// customer: the endpoint answers `customerNotified: false`, and this page says
// so next to the button rather than letting "Offered" read as "told".
// Confirming or cancelling a waitlisted request happens on the booking's own
// page, which already has the status form; once a request is no longer
// `requested` it leaves this list.

const RESOURCE_TYPES = Object.freeze(["equipment", "vehicle", "trailer", "appliance", "tool", "device", "furniture", "other"]);

const PROBLEMS = Object.freeze({
  waitlist_contact_required: "Add a name, an email or a phone number, so you can reach them when a place opens.",
  resource_name_required: "Give the resource a name.",
  invalid_booking_id: "That is not one of your waiting-list entries.",
  waitlist_entry_not_found: "That is not one of your waiting-list entries.",
  database_request_failed: "That could not be saved just now. Nothing was recorded.",
  database_unreachable: "That could not be saved just now. Nothing was recorded.",
  business_workspace_required: "We could not tell which business you are signed in to, so nothing was saved.",
  supabase_setup_required: "Your account database is not connected yet, so nothing was saved."
});

const DONE = Object.freeze({
  waitlist: "Added to the waiting list.",
  offer: "Marked as offered. The customer has not been told -- contact them yourself.",
  resource: "Resource added."
});

const BOOKING_PAGE = "/business-builder/owner/bookings";

function notice(query = {}, escape) {
  const problem = PROBLEMS[String(query.problem || "")];
  const done = DONE[String(query.done || "")];
  if (problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>${escape(problem)}</p></article>`;
  if (query.problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>That could not be saved. Nothing was recorded.</p></article>`;
  if (done) return `<article class="card" role="status"><h2>Saved</h2><p>${escape(done)}</p></article>`;
  return "";
}

const words = (value) => String(value || "").replaceAll("_", " ");
const hidden = (name, value, escape) => `<input type="hidden" name="${name}" value="${escape(value)}">`;

// Three states: could not read, nothing yet, and the list.
function listOrSay(result, empty, render) {
  if (!result || result.ok === false) return "<p>We could not read these just now. This is not the same as having none.</p>";
  if (!result.rows.length) return `<p>${empty}</p>`;
  return render(result.rows);
}

function resourceNames(ids, resources) {
  if (!Array.isArray(ids) || !ids.length) return "Any";
  if (!resources || resources.ok === false) return `${ids.length} chosen`;
  const byId = new Map(resources.rows.map((row) => [row.id, row.name]));
  return ids.map((id) => byId.get(id) || "A resource no longer listed").join(", ");
}

function preferred(meta = {}) {
  const start = String(meta.preferred_start || "").replace("T", " ");
  const end = String(meta.preferred_end || "").replace("T", " ");
  if (start && end) return `${start} to ${end}`;
  return start || end || "Any time";
}

function waitlistCard(waitlist, resources, { back, escape }) {
  const list = listOrSay(waitlist, "Nobody is waiting.", (rows) => `<table><thead><tr><th>Who</th><th>Contact</th><th>People</th><th>When they want</th><th>For</th><th>Waiting since</th><th>Where it stands</th><th></th></tr></thead><tbody>${rows.map((row) => {
    const meta = row.metadata || {};
    const offered = meta.waitlist_state === "offered";
    const action = offered
      ? `<a href="${escape(`${BOOKING_PAGE}/${row.id}`)}">Confirm or cancel</a>`
      : `<form method="post" action="${escape(`/api/business/waitlist/${row.id}/offer`)}">${hidden("back", back, escape)}<button type="submit">Mark an opening offered</button></form> <a href="${escape(`${BOOKING_PAGE}/${row.id}`)}">Open</a>`;
    return `<tr><td>${escape(row.customer_name || "Not named")}</td><td>${escape(row.customer_email || row.customer_phone || "None")}</td><td>${escape(String(meta.party_size ?? 1))}</td><td>${escape(preferred(meta))}</td><td>${escape(resourceNames(meta.resource_ids, resources))}</td><td>${escape(String(row.created_at || "").slice(0, 10))}</td><td>${escape(offered ? `Offered ${String(meta.offered_at || "").slice(0, 10)}` : "Waiting")}</td><td>${action}</td></tr>`;
  }).join("")}</tbody></table>`);
  return `<article class="card"><h2>Waiting list</h2><p class="fine">Marking an opening offered records it here. It does not send the customer anything. To give them the place, open the request and confirm it; to take them off the list, cancel it.</p>${list}</article>`;
}

function addToWaitlistForm(resources, { back, escape }) {
  const choices = resources && resources.ok !== false && resources.rows.length
    ? `<fieldset><legend>What they want to book (optional)</legend>${resources.rows.map((row) => `<label><input type="checkbox" name="resource_ids" value="${escape(row.id)}"> ${escape(row.name)}</label>`).join("")}</fieldset>`
    : "";
  return `<article class="card"><h2>Add someone to the waiting list</h2><form method="post" action="/api/business/waitlist">${hidden("back", back, escape)}<label>Name<input name="customer_name" maxlength="200"></label><label>Email<input name="customer_email" type="email" maxlength="320"></label><label>Phone<input name="customer_phone" type="tel" maxlength="80"></label><p class="fine">At least one of the three, so you can reach them.</p><label>How many people<input name="party_size" type="number" min="1" max="1000" value="1"></label><label>Earliest time that suits them<input name="preferred_start" type="datetime-local"></label><label>Latest time that suits them<input name="preferred_end" type="datetime-local"></label>${choices}<label>Notes<textarea name="notes" maxlength="2000"></textarea></label><button class="action" type="submit">Add to waiting list</button></form></article>`;
}

function resourcesCard(resources, { back, escape }) {
  const list = listOrSay(resources, "Nothing bookable yet.", (rows) => `<table><thead><tr><th>Resource</th><th>Kind</th><th>Holds</th><th>Notes</th></tr></thead><tbody>${rows.map((row) => {
    const meta = row.metadata || {};
    return `<tr><td>${escape(row.name || "Unnamed")}</td><td>${escape(words(meta.resource_type || row.asset_type))}</td><td>${escape(String(meta.capacity ?? 1))}</td><td>${escape(meta.notes || "")}</td></tr>`;
  }).join("")}</tbody></table>`);
  return `<article class="card"><h2>What customers can book</h2><p class="fine">Rooms, tables, chairs, vehicles or equipment a booking can ask for.</p>${list}<form method="post" action="/api/business/reservation-resources">${hidden("back", back, escape)}<label>Name<input name="name" required maxlength="160"></label><label>Kind<select name="resource_type">${RESOURCE_TYPES.map((value) => `<option value="${value}">${words(value)}</option>`).join("")}</select></label><label>How many people it holds<input name="capacity" type="number" min="1" max="1000" value="1"></label><label>Notes<textarea name="notes" maxlength="1000"></textarea></label><button type="submit">Add resource</button></form></article>`;
}

module.exports = {
  RESOURCE_TYPES,
  PROBLEMS,
  DONE,
  notice,
  waitlistCard,
  addToWaitlistForm,
  resourcesCard
};
