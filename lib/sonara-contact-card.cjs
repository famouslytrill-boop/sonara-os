"use strict";

// A customer, as a file a phone will open.
//
// The third of these. Bookings became calendar files, records became CSV, and
// this is contacts -- the same shape each time, and the shape is the point: a
// record this product already holds, written into a format something else
// already reads, with no dependency, no service the owner runs, and no
// per-customer cost.
//
// "Customer & Enquiry Tracker" is a paid product. Getting a customer's number
// into the phone you will actually ring them from is the least a contact list
// can do, and a grep for VCARD across server.js, lib/ and routes/ found nothing
// before this.
//
// RFC 6350 is close enough to iCalendar that the awkward parts are the same
// ones, and they are done rather than approximated for the same reason: a
// malformed .vcf does not error. The phone imports nothing, or imports a
// contact with the name in the wrong field, and nobody is told.
//
//   **CRLF on every line**, including the last (section 3.2).
//   **Folding at 75 octets**, counted with Buffer.byteLength, because counting
//   characters splits a multi-byte character in half and one accented name does it.
//   **Escaping** backslash, comma, semicolon and newline in TEXT values -- and
//   NOT in the structured N field's own separators, which is the difference
//   between "Smith;John" as two name parts and "Smith\;John" as one.
//
// One thing vCard has that iCalendar does not: the N property is positional,
// five semicolon-separated components. This product stores a single `name`
// column and does not know which part is a family name, so N is written with
// the whole value in the first position and the rest empty. That is honest --
// guessing that the last word is a surname is wrong for most of the world.

const CRLF = "\r\n";

// RFC 6350 3.4: backslash first, or the escapes it adds get escaped again.
// The comma and semicolon are escaped because an unescaped one splits the value
// into a list.
function escapeText(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/\\/g, "\\\\")
    // "\\;" and not "\;". The second is just ";" once JavaScript has read the
    // literal, so it compiles, runs, and emits an unescaped semicolon -- which
    // in a vCard splits a name into two components. This exact mistake was made
    // in lib/sonara-calendar-invite.cjs first and repeated here, so
    // tests/an-export-opens-in-a-spreadsheet.test.js now asserts both modules
    // escape it rather than each test guarding only its own.
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// Fold to 75 octets, continuing with a single leading space.
function foldLine(line) {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const out = [];
  let current = "";
  let limit = 75;
  for (const character of Array.from(line)) {
    if (Buffer.byteLength(current + character, "utf8") > limit) {
      out.push(current);
      current = character;
      limit = 74;
    } else {
      current += character;
    }
  }
  if (current) out.push(current);
  return out.join(`${CRLF} `);
}

// What a contact needs before a file is worth making.
//
// A name and nothing else is a valid vCard and a useless one: it imports a
// contact somebody cannot call, write to, or tell apart from another of the
// same name. So a way of reaching them is required, and the refusal says which
// is missing rather than producing an empty card.
function contactability(customer) {
  const row = customer && typeof customer === "object" ? customer : {};
  if (!row.id) return { ok: false, code: "no_identifier", message: "This customer has no identifier yet, so there is nothing to export." };
  const name = String(row.name || "").trim();
  if (!name) {
    return { ok: false, code: "no_name", message: "This customer has no name, so a contact card would have nothing to file it under." };
  }
  const email = String(row.email || "").trim();
  const phone = String(row.phone || "").trim();
  if (!email && !phone) {
    return {
      ok: false,
      code: "no_way_to_reach_them",
      message: "This customer has no email address and no phone number, so a contact card would import somebody you still could not contact. Add one first."
    };
  }
  return { ok: true, name, email, phone };
}

// The lines of one card, so a single download and a whole list are built by the
// same code. Two builders of one format drift until a phone accepts one and
// refuses the other.
function cardLines(customer, verdict, settings) {
  const organisation = String(settings.businessName || "").trim();
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];

  // N is positional and its semicolons are separators, not content -- so the
  // components are escaped individually and joined with raw semicolons.
  lines.push(`N:${escapeText(verdict.name)};;;;`);
  lines.push(`FN:${escapeText(verdict.name)}`);
  if (organisation) lines.push(`ORG:${escapeText(organisation)}`);
  if (verdict.phone) lines.push(`TEL;TYPE=CELL:${escapeText(verdict.phone)}`);
  if (verdict.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(verdict.email)}`);

  // Where the record came from and what it is now, as a note rather than as
  // invented fields. A phone has nowhere to put "status: lead".
  const note = [
    customer.status ? `Status: ${customer.status}` : "",
    customer.source ? `First heard from: ${customer.source}` : "",
    Array.isArray(customer.tags) && customer.tags.length ? `Tags: ${customer.tags.join(", ")}` : ""
  ].filter(Boolean).join("\n");
  if (note) lines.push(`NOTE:${escapeText(note)}`);

  // Stable across regenerations, so re-importing updates the contact rather
  // than creating a second one.
  lines.push(`UID:${escapeText(`${customer.id}@${String(settings.domain || "sonara.industries").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`)}`);
  lines.push("END:VCARD");
  return lines;
}

function render(lines) {
  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}

function buildContactCard(customer, options) {
  const settings = options && typeof options === "object" ? options : {};
  const verdict = contactability(customer);
  if (!verdict.ok) return verdict;
  return {
    ok: true,
    filename: `customer-${String(customer.id).replace(/[^a-zA-Z0-9-]/g, "")}.vcf`,
    contentType: "text/vcard; charset=utf-8",
    body: render(cardLines(customer, verdict, settings))
  };
}

// The whole list. A .vcf may hold many cards one after another, which is how
// every phone imports an address book.
//
// A customer who cannot be turned into a card is skipped and **counted**, and
// the count travels: a contacts file quietly missing nine people is an address
// book that lies by being incomplete, and the business has no way to notice.
function buildContactBook(customers, options) {
  const settings = options && typeof options === "object" ? options : {};
  const rows = Array.isArray(customers) ? customers : null;
  // null and [] are different answers. A failed read must not render as a
  // business with no customers.
  if (!rows) {
    return { ok: false, code: "not_a_list", message: "We could not read your customers just now, so no contacts file was made." };
  }

  const cards = [];
  const skipped = [];
  for (const customer of rows) {
    const verdict = contactability(customer);
    if (!verdict.ok) {
      skipped.push({ id: customer && customer.id ? String(customer.id) : null, code: verdict.code, message: verdict.message });
      continue;
    }
    cards.push(...cardLines(customer, verdict, settings));
  }

  return {
    ok: true,
    included: rows.length - skipped.length,
    skipped,
    filename: "customers.vcf",
    contentType: "text/vcard; charset=utf-8",
    // An empty book is a real answer and an empty file is the honest form of
    // it: there is no VCARD wrapper to write when there are no cards.
    body: cards.length ? render(cards) : ""
  };
}

module.exports = { buildContactCard, buildContactBook, contactability, escapeText, foldLine };
