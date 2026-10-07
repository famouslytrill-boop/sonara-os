// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const RESOURCE_PAGE = "/business-builder/owner/reservation-resources";
const WAITLIST_PAGE = "/business-builder/owner/waitlist";

function createReservationPages({ layout, linkAction, escapeHtml }) {
  for (const [name, value] of Object.entries({ layout, linkAction, escapeHtml })) {
    if (typeof value !== "function") throw new TypeError(name + " is required for reservation pages");
  }
  const escape = escapeHtml;
  const card = (title, body) => '<article class="card"><h2>' + escape(title) + "</h2>" + body + "</article>";
  const path = (base, workspaceId) => base + (workspaceId ? "?workspaceId=" + encodeURIComponent(workspaceId) : "");
  const hidden = (workspaceId) => workspaceId
    ? '<input type="hidden" name="workspaceId" value="' + escape(workspaceId) + '">' : "";
  const field = (name, label, value, type = "text", extra = "") =>
    '<label for="reservation-' + name + '">' + escape(label) + '</label><input id="reservation-' + name
      + '" name="' + name + '" type="' + type + '" value="' + escape(value ?? "") + '" ' + extra + ">";
  const area = (name, label, value, max) =>
    '<label for="reservation-' + name + '">' + escape(label) + '</label><textarea id="reservation-' + name
      + '" name="' + name + '" maxlength="' + max + '">' + escape(value || "") + "</textarea>";
  const select = (name, label, choices, selected) =>
    '<label for="reservation-' + name + '">' + escape(label) + '</label><select id="reservation-' + name
      + '" name="' + name + '">' + choices.map(([value, text]) => '<option value="' + escape(value)
      + '"' + (String(selected || "") === String(value) ? " selected" : "") + ">" + escape(text) + "</option>").join("") + "</select>";
  const notice = (message, error) => message ? card(error ? "Please check this" : "Saved",
    '<p role="' + (error ? "alert" : "status") + '">' + escape(message) + "</p>") : "";
  const partial = (truncated) => truncated ? card("There may be more records",
    "<p>This page shows a limited set of records. It does not claim to show the whole list.</p>") : "";
  const time = (value) => {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "Not recorded";
  };
  const actions = (workspaceId, otherPage, otherName) => [
    linkAction(path("/business-builder/owner/bookings", workspaceId), "Bookings"),
    linkAction(path(otherPage, workspaceId), otherName)
  ];

  function resources({ rows = [], locations = [], input = {}, workspaceId = "", message = "", error = false,
    unreadable = false, truncated = false, createAction }) {
    const sections = [notice(message, error), partial(truncated)];
    if (unreadable) sections.push(card("We could not read your resources",
      "<p>Refresh this page to check your saved resources. No empty list is claimed while the records are unavailable.</p>"));
    else if (!rows.length) sections.push(card("No resources yet",
      "<p>Add a table, room, vehicle or piece of equipment that customers can reserve.</p>"));
    else for (const row of rows) {
      const location = locations.find((item) => item.id === row.location_id)?.name || "Not assigned";
      sections.push(card(row.name || "Unnamed resource",
        "<dl><dt>Kind</dt><dd>" + escape(row.metadata?.resource_type || row.asset_type || "Not recorded")
          + "</dd><dt>Capacity</dt><dd>" + escape(row.metadata?.capacity ?? "Not recorded")
          + "</dd><dt>Location</dt><dd>" + escape(location) + "</dd></dl>"
          + (row.metadata?.notes ? "<p>" + escape(row.metadata.notes) + "</p>" : "")));
    }
    const form = '<form class="auth-form" method="post" action="' + escape(createAction) + '">' + hidden(workspaceId)
      + field("name", "Resource name", input.name, "text", 'required maxlength="160"')
      + select("resource_type", "Kind", [["table", "Table"], ["room", "Room"], ["equipment", "Equipment"],
        ["vehicle", "Vehicle"], ["other", "Other"]], input.resource_type || "equipment")
      + field("capacity", "Capacity", input.capacity ?? 1, "number", 'required min="1" max="1000" step="1"')
      + select("location_id", "Location", [["", "No location assigned"], ...locations.map((row) => [row.id, row.name])], input.location_id)
      + area("notes", "Notes", input.notes, 1000)
      + '<button class="button" type="submit">Add resource</button></form>';
    sections.push(card("Add a resource", form));
    return layout({ title: "Reservation resources", eyebrow: "Business Builder", heading: "Reservation resources",
      body: "Keep the tables, rooms, vehicles and equipment your customers can reserve in one place.",
      authenticated: true, sections: sections.filter(Boolean), actions: actions(workspaceId, WAITLIST_PAGE, "Waitlist") });
  }

  function waitlist({ rows = [], resources = [], input = {}, workspaceId = "", message = "", error = false,
    unreadable = false, truncated = false, createAction, offerAction }) {
    const sections = [notice(message, error), partial(truncated)];
    if (unreadable) sections.push(card("We could not read your waitlist",
      "<p>Refresh this page to check who is waiting. No empty list is claimed while the records are unavailable.</p>"));
    else if (!rows.length) sections.push(card("Nobody is waiting",
      "<p>Add a customer below when their preferred time or resource is unavailable.</p>"));
    else for (const row of rows) {
      const state = row.metadata?.waitlist_state || "waiting";
      const labels = { waiting: "Waiting", offered: "Offer recorded" };
      const requested = (Array.isArray(row.metadata?.resource_ids) ? row.metadata.resource_ids : [])
        .map((id) => resources.find((resource) => resource.id === id)?.name || "Resource not available");
      let inner = "<dl><dt>Contact</dt><dd>" + escape([row.customer_email, row.customer_phone].filter(Boolean).join(" / ") || "Not recorded")
        + "</dd><dt>Status</dt><dd>" + escape(labels[state] || "Review booking")
        + "</dd><dt>Party size</dt><dd>" + escape(row.metadata?.party_size ?? "Not recorded")
        + "</dd><dt>Preferred start</dt><dd>" + escape(time(row.metadata?.preferred_start))
        + "</dd><dt>Preferred end</dt><dd>" + escape(time(row.metadata?.preferred_end))
        + "</dd><dt>Resources</dt><dd>" + escape(requested.join(", ") || "Any resource") + "</dd></dl>"
        + (row.notes ? "<p>" + escape(row.notes) + "</p>" : "")
        + linkAction(path("/business-builder/owner/bookings/" + encodeURIComponent(row.id), workspaceId), "Open booking");
      if (state === "waiting" && row.status === "requested") {
        inner += '<form method="post" action="' + escape(offerAction.replace(":bookingId", encodeURIComponent(row.id)))
          + '">' + hidden(workspaceId) + '<button class="button" type="submit">Record offer</button></form>';
      } else if (state === "offered") inner += "<p>Contact the customer directly and open their booking to confirm the agreed time.</p>";
      sections.push(card(row.customer_name || row.customer_email || row.customer_phone || "Waiting customer", inner));
    }
    const selected = new Set(Array.isArray(input.resource_ids) ? input.resource_ids : [input.resource_ids].filter(Boolean));
    const resourceChoices = resources.map((row) => '<option value="' + escape(row.id) + '"'
      + (selected.has(row.id) ? " selected" : "") + ">" + escape(row.name) + "</option>").join("");
    const form = '<form class="auth-form" method="post" action="' + escape(createAction) + '">' + hidden(workspaceId)
      + field("customer_name", "Customer name", input.customer_name, "text", 'maxlength="200"')
      + field("customer_email", "Email", input.customer_email, "email", 'maxlength="320"')
      + field("customer_phone", "Phone", input.customer_phone, "tel", 'maxlength="80"')
      + '<p>Enter a name, email or phone so you can identify the customer.</p>'
      + field("party_size", "Party size", input.party_size ?? 1, "number", 'required min="1" max="1000" step="1"')
      + field("preferred_start", "Preferred start (UTC)", input.preferred_start, "datetime-local")
      + field("preferred_end", "Preferred end (UTC)", input.preferred_end, "datetime-local")
      + '<label for="reservation-resource_ids">Preferred resources</label><select id="reservation-resource_ids" name="resource_ids" multiple size="4">'
      + resourceChoices + "</select><p>Leave the resource selection empty for any resource.</p>"
      + area("notes", "Notes", input.notes, 2000)
      + '<button class="button" type="submit">Add to waitlist</button></form>';
    sections.push(card("How offers work",
      "<p>Recording an offer saves a marker for your team. Contact the customer directly to agree the booking, then confirm it from their booking page.</p>"));
    sections.push(card("Add a waiting customer", form));
    return layout({ title: "Waitlist", eyebrow: "Business Builder", heading: "Waitlist",
      body: "Track waiting customers, record an offer and open the booking when they agree a time.",
      authenticated: true, sections: sections.filter(Boolean), actions: actions(workspaceId, RESOURCE_PAGE, "Reservation resources") });
  }
  return { resources, waitlist };
}

module.exports = { createReservationPages, RESOURCE_PAGE, WAITLIST_PAGE };

