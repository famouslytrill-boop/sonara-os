"use strict";

// Correcting a record that was typed in wrong.
//
// Twenty-six of the twenty-seven Business Builder owner record pages declare a
// create form. **None of them could change a saved record.** A customer's phone
// number entered with a digit missing, a quote priced at 450 instead of 4500, a
// booking put against the wrong service — the only recourse in the product was
// to create a second record and leave the wrong one sitting there.
//
// That is worse than an inconvenience for a business: an address book with two
// entries for the same person, one of which cannot be reached, is a worse
// address book than one with a single wrong entry, because now nobody knows
// which is current.
//
// `lib/sonara-record-status.cjs` did the one field whose whole purpose is to
// change. This does the rest of them.
//
// ## The fields come from the page, and nothing else is written
//
// The create form already declares every field this record kind has, with its
// type, its length and its options, and the database enforces the rest. This
// reads that declaration and builds the patch from it — so a body key the form
// never declared is not written, whatever it is called.
//
// That is the security property, not a tidiness one. The patch goes out with
// the service role key, which bypasses row level security, so a body carrying
// `organization_id` or `id` would otherwise be a way to move somebody else's
// record into your business or yours into theirs. Building the patch from a
// fixed list rather than filtering a hostile one means a new attack name has
// nothing to land on.
//
// ## What it deliberately does not do
//
// **It does not offer an edit form for a page whose form is not a create form.**
// `/business-builder/owner/time` posts to `/api/business/time-entries/start`,
// because clocking in is not "create a time entry with these values" — the
// server stamps the time, and a form that let somebody type their own clock-in
// time would be a different feature with different consequences. A page that
// names its own action is left alone.
//
// **It does not write a field that was not on the form the person submitted.**
// A patch of every declared field would overwrite a column somebody else edited
// in the seconds between the form loading and being saved, with a value the
// person editing never looked at. Only what actually differs from the row that
// was read is sent.

/** Whether a page has a form this can turn into an edit form. */
function canEdit(page) {
  const form = page?.form;
  if (!form || !Array.isArray(form.fields) || !form.fields.length) return false;
  // A form with its own action does something other than create this record.
  if (form.action) return false;
  return editableFields(page).length > 0;
}

/**
 * The fields an edit form may offer.
 *
 * Everything the create form declares, minus anything without a name. There is
 * no second list of "editable" columns on purpose: a column somebody may type
 * in when creating a record is a column they may correct afterwards, and a
 * divergence between the two lists would be a rule nobody wrote down.
 */
function editableFields(page) {
  const fields = page?.form?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter((field) => field && typeof field.name === "string" && field.name);
}

/** The value to put in the form for a field, as a string the input can carry. */
function currentValue(field, row) {
  if (!row || !field) return "";
  const raw = row[field.name];
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "true" : "false";
  const text = String(raw);
  // Postgres hands back a full timestamp; `datetime-local` will not display one
  // with a zone or seconds on it, and an input that silently shows nothing is
  // how an edit form quietly clears a field somebody never touched.
  if (field.type === "datetime-local") return text.slice(0, 16).replace(" ", "T");
  if (field.type === "date") return text.slice(0, 10);
  return text;
}

/**
 * The patch to send, built from the page's declaration and the row as read.
 *
 * Returns `{ ok, patch, changed }` or `{ ok: false, code, detail }`. `changed`
 * names the fields that actually differ, which is what makes the confirmation
 * afterwards say what happened rather than only that something was submitted.
 */
function changesFrom(page, body, row) {
  const fields = editableFields(page);
  if (!fields.length) return { ok: false, code: "not_editable", detail: "This kind of record cannot be corrected here." };
  const submitted = body && typeof body === "object" ? body : {};

  const patch = {};
  const changed = [];
  for (const field of fields) {
    // A field the submitted form did not carry is a field this save is not
    // about. Absent is not blank: a body missing a key must not clear a column.
    if (!Object.prototype.hasOwnProperty.call(submitted, field.name)) continue;

    const raw = submitted[field.name];
    const text = raw === null || raw === undefined ? "" : String(raw).trim();

    if (!text && field.required) {
      return { ok: false, code: "missing_required", detail: `${field.label || field.name} cannot be left empty.` };
    }

    // A select may only carry what it offers, and a reference may only carry a
    // record id. Both are enforced here rather than left to the database, whose
    // refusal is a check-constraint message nobody outside this file can read.
    if (text && field.type === "select") {
      const allowed = (field.options || []).map((option) => (option && typeof option === "object" ? option.value : option));
      if (!allowed.includes(text)) {
        return { ok: false, code: "unknown_option", detail: `${field.label || field.name} can be ${allowed.join(", ")}. Not ${text}.` };
      }
    }
    if (text && field.type === "reference" && !UUID.test(text)) {
      return { ok: false, code: "bad_reference", detail: `${field.label || field.name} is not one of ours.` };
    }
    if (field.maxLength && text.length > Number(field.maxLength)) {
      return { ok: false, code: "too_long", detail: `${field.label || field.name} is longer than ${field.maxLength} characters.` };
    }

    // Blank clears the column rather than writing an empty string, because ""
    // and "not recorded" are different answers and only one of them is honest
    // about a field somebody deliberately emptied.
    const value = text === "" ? null : text;
    const before = row ? row[field.name] : undefined;
    if (same(before, value, field.type)) continue;
    patch[field.name] = value;
    changed.push(field.label || field.name);
  }

  return { ok: true, patch, changed };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Whether the stored value and the submitted one are the same thing.
//
// The submitted side is always a string or null, because that is what a form
// posts. The stored side may be a number, a boolean, a timestamp with a zone,
// or null. Comparing them with === would report every unchanged number as
// changed, which is how an edit form ends up rewriting the whole record every
// time somebody presses save.
function same(before, after, type) {
  if (before === null || before === undefined) return after === null;
  if (after === null) return false;
  if (typeof before === "number") return Number(after) === before;
  if (typeof before === "boolean") return String(before) === after;
  const stored = String(before);
  if (stored === after) return true;
  // A timestamp read back carries a zone and seconds the input never showed, so
  // for those two field types the part the person could actually see is the
  // only comparison that can be true when they changed nothing.
  //
  // Restricted to those two types deliberately. The first draft applied it to
  // everything, which made shortening any text a no-op: correcting "Ada L" to
  // "Ada" was read as unchanged, because the stored value starts with the new
  // one. An edit form that silently declines to shorten a name is worse than no
  // edit form, because it reports the save as done.
  if ((type === "datetime-local" || type === "date") && after.length && stored.startsWith(after)) return true;
  return false;
}

/** What to say after a save. */
function describeEdit(changed) {
  const names = Array.isArray(changed) ? changed.filter(Boolean) : [];
  // Not a failure and not a change. Saying "saved" when nothing differed tells
  // somebody a write happened that did not.
  if (!names.length) return "Nothing was different, so nothing was changed.";
  if (names.length === 1) return `${names[0]} updated.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} updated.`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} updated.`;
}

module.exports = { canEdit, editableFields, currentValue, changesFrom, describeEdit };
