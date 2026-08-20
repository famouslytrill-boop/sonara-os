"use strict";

// Bringing a spreadsheet in.
//
//   GET  /business-builder/owner/customers/import   paste it, see what will happen
//   POST /api/business/customers/import             preview, or write
//
// One endpoint for both steps, and the difference is a `confirm` field. The
// alternative -- previewing into a stored draft and confirming against its id --
// needs a table, an expiry and a cleanup, to hold something for ninety seconds.
//
// ## Preview and confirm read the same text
//
// The confirm step re-reads the pasted text through the same reader rather than
// trusting a list of rows carried back from the page. So the records written
// are the records that reader produces from what the person actually pasted,
// and a hidden field cannot smuggle in a row the preview never showed. The
// counts are shown again afterwards for the same reason.
//
// ## What it will not do
//
// **It will not import some of them and say "done".** Every row is either
// written, or reported with its line number and why. An importer that quietly
// loses six rows in a hundred is found out when one of those six is not called
// back, and by then the sheet is gone.
//
// **It will not update anything.** Everything here is an insert. Matching a
// pasted row to an existing customer and overwriting them is a different
// feature with a different failure -- it is how somebody's phone number gets
// replaced by a stale one from an old export -- and it is not this one.
//
// **It will not silently create the same person twice.** Rows matching an
// existing customer closely enough are flagged in the preview, using the
// measured threshold in lib/sonara-operations-science.cjs. Flagged, not
// blocked: two real people do share a name, and the business is the only one
// who knows.

const { readSheet, summarise } = require("../lib/sonara-tabular-import.cjs");
const { findDuplicateCustomers } = require("../lib/sonara-operations-science.cjs");

const TABLE = "customers";
const MAX_PASTE_CHARACTERS = 200000;
const MAX_ROWS = 500;

function ok(value) { return { ok: true, value }; }

// The columns a customer sheet may carry. Every one of these is a column on
// `customers`, checked against supabase/migrations by the test beside this.
const CUSTOMER_FIELDS = Object.freeze([
  {
    column: "name", label: "Name", required: true,
    aliases: ["full name", "customer", "customer name", "client", "client name", "company", "business"],
    validate: (value) => (value.length <= 200 ? ok(value) : { ok: false, reason: "longer than 200 characters" })
  },
  {
    column: "email", label: "Email", required: false,
    aliases: ["email address", "e mail", "contact email"],
    validate: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200
      ? ok(value.toLowerCase())
      : { ok: false, reason: `"${value}" is not an email address` })
  },
  {
    column: "phone", label: "Phone", required: false,
    aliases: ["telephone", "tel", "mobile", "phone number", "contact number"],
    // Deliberately permissive. Phone numbers carry spaces, brackets, plus
    // signs and extensions, and a validator strict enough to be useful here
    // rejects real numbers -- which costs a customer more than a messy one does.
    validate: (value) => (value.length <= 40 ? ok(value) : { ok: false, reason: "longer than 40 characters" })
  },
  {
    column: "source", label: "How they found you", required: false,
    aliases: ["source", "referrer", "how they found us", "lead source"],
    validate: (value) => (value.length <= 120 ? ok(value) : { ok: false, reason: "longer than 120 characters" })
  },
  {
    column: "status", label: "Status", required: false,
    aliases: ["state"],
    validate: (value) => {
      const status = value.toLowerCase();
      return ["active", "inactive", "archived"].includes(status)
        ? ok(status)
        : { ok: false, reason: `"${value}" is not one of active, inactive or archived` };
    }
  }
]);

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders"
];

function registerImportRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerImportRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;
  const PAGE = "/business-builder/owner/customers/import";

  function htmlCard(title, inner) {
    return `<article class="card sonara-depth" data-sonara-enter><h2>${escapeHtml(title)}</h2>${inner}</article>`;
  }

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok || !org?.ok || !org.organizationId) return null;
    return { config, organizationId: org.organizationId, userId: user?.id || null };
  }

  // The customers already on file, for the duplicate warning.
  //
  // Returns ok:false on a failed read and the caller says the check did not run
  // rather than showing an import with no warnings on it -- "no duplicates
  // found" and "we did not look" are the same screen otherwise.
  async function readExisting(config, organizationId) {
    const path = `${TABLE}?organization_id=eq.${enc(organizationId)}&select=id,name,email,phone&limit=2000`;
    const response = await fetch(`${config.url}/rest/v1/${path}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? { ok: true, rows } : { ok: false, rows: [] };
  }

  function pasteForm(text = "", confirm = false, records = 0) {
    return `<form method="post" action="/api/business/customers/import" class="sonara-import-form">
      <label>Paste your customers here
        <textarea name="sheet" rows="12" maxlength="${MAX_PASTE_CHARACTERS}" spellcheck="false" placeholder="Name,Email,Phone&#10;Jo Smith,jo@example.com,555 0100">${escapeHtml(text)}</textarea>
      </label>
      ${confirm ? `<input type="hidden" name="confirm" value="yes">` : ""}
      <button type="submit">${confirm ? `Add ${records} ${records === 1 ? "customer" : "customers"}` : "See what will happen"}</button>
    </form>`;
  }

  function explainer() {
    return [
      brandCard(
        "Copy the cells and paste them in",
        "Select your rows in Excel, Numbers or Google Sheets and copy them. The first line has to be your column headings. Nothing is added until you have seen what will happen and pressed the button again."
      ),
      brandCard(
        "The headings it understands",
        CUSTOMER_FIELDS.map((field) => `${field.label}${field.required ? " (needed)" : ""}`).join(" · ")
      ),
      brandCard(
        "It adds people, it never changes them",
        "Every row becomes a new customer. Nothing already on file is edited or overwritten, so a stale export cannot replace a phone number you have since corrected."
      )
    ];
  }

  function page(res, { sections, status = 200 }) {
    return res.status(status).type("html").send(layout({
      title: "Bring your customers in",
      eyebrow: "Business Builder",
      heading: "Bring your customers in",
      body: "Paste them from a spreadsheet rather than typing them again.",
      sections,
      actions: [linkAction("/business-builder/owner/customers", "Your customers"), linkAction("/business-builder/dashboard", "Back to your workspace")]
    }));
  }

  app.get(PAGE, requireBusinessManager, async (req, res) => {
    return page(res, { sections: [htmlCard("Your spreadsheet", pasteForm()), ...explainer()] });
  });

  app.post("/api/business/customers/import", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope) {
      return page(res, {
        status: 503,
        sections: [brandCard("Your workspace could not be read", "Nothing was imported. This is a problem on our side -- try again shortly.")]
      });
    }

    const text = String(req.body?.sheet || "");
    if (text.length > MAX_PASTE_CHARACTERS) {
      return page(res, {
        sections: [
          brandCard("That is more than this can take at once", `Paste up to about ${Math.floor(MAX_PASTE_CHARACTERS / 1000)},000 characters at a time. Nothing was imported.`),
          htmlCard("Your spreadsheet", pasteForm())
        ]
      });
    }

    const result = readSheet({ text, fields: CUSTOMER_FIELDS, limit: MAX_ROWS });

    if (!result.ok) {
      return page(res, {
        sections: [brandCard("This could not be read", result.reason), htmlCard("Try again", pasteForm(text)), ...explainer()]
      });
    }

    const confirm = String(req.body?.confirm || "") === "yes";

    if (!confirm) {
      const existing = await readExisting(scope.config, scope.organizationId);
      const sections = [brandCard("What will happen", summarise(result))];

      if (result.records.length) {
        sections.push(htmlCard("These will be added", `<ol class="sonara-import-preview">${result.records.map((entry) =>
          `<li>${escapeHtml(entry.record.name)}${entry.record.email ? ` · ${escapeHtml(entry.record.email)}` : ""}${entry.record.phone ? ` · ${escapeHtml(entry.record.phone)}` : ""}</li>`).join("")}</ol>`));
      }

      if (result.rejected.length) {
        sections.push(htmlCard("These cannot be added yet", `<ul class="sonara-import-problems">${result.rejected.map((entry) =>
          `<li><strong>Line ${entry.line}</strong>: ${escapeHtml(entry.problems.join("; "))}</li>`).join("")}</ul>
          <p class="fine">Fix them in your spreadsheet and paste again. The rest can go in now -- these are not holding anything up.</p>`));
      }

      if (result.unrecognised.length) {
        sections.push(brandCard(
          "Headings this does not understand",
          `${result.unrecognised.join(", ")}. Those columns are ignored -- nothing in them is imported. Rename them if they should come in.`
        ));
      }
      if (result.duplicated.length) {
        sections.push(brandCard(
          "Two columns for the same thing",
          `${result.duplicated.join(", ")}. Only the first was used, and the second was ignored rather than overwriting it.`
        ));
      }

      // Likely repeats of somebody already on file.
      if (!existing.ok) {
        sections.push(brandCard(
          "We could not check for people you already have",
          "This is not saying there are none. If you import now you may end up with somebody twice."
        ));
      } else if (existing.rows.length && result.records.length) {
        const matches = findDuplicateCustomers([
          ...existing.rows.map((row) => ({ id: `existing:${row.id}`, name: row.name, email: row.email, phone: row.phone })),
          ...result.records.map((entry, index) => ({ id: `new:${index}`, name: entry.record.name, email: entry.record.email, phone: entry.record.phone }))
        ]);
        // Only pairs that cross the line between "already here" and "coming
        // in". Two similar names inside the sheet are the business's own
        // duplicates and not something this import created.
        // findDuplicateCustomers returns pairs shaped
        // { left, right, leftId, rightId, reason, ... }. The prefixes on the
        // ids are what makes "already here" and "coming in" tellable apart
        // after the two lists are compared as one.
        const crossing = (matches?.pairs || []).filter((pair) =>
          String(pair.leftId || "").startsWith("existing:") !== String(pair.rightId || "").startsWith("existing:"));
        if (crossing.length) {
          sections.push(htmlCard("You may already have these", `<ul>${crossing.slice(0, 25).map((pair) =>
            `<li>${escapeHtml(String(pair.left || ""))} and ${escapeHtml(String(pair.right || ""))} \u2014 ${escapeHtml(String(pair.reason || ""))}</li>`).join("")}</ul>
            <p class="fine">Flagged, not blocked. Two real people do share a name, and you are the only one who knows.</p>`));
        }
      }

      sections.push(result.records.length
        ? htmlCard("Add them", pasteForm(text, true, result.records.length))
        : brandCard("Nothing to add", "No row in this paste can be imported yet. Fix what is above and try again."));

      return page(res, { sections });
    }

    // Confirmed. Re-read above, from the same text, through the same reader --
    // so what is written is what the preview showed rather than a list carried
    // back through a form field.
    if (!result.records.length) {
      return page(res, { sections: [brandCard("Nothing was imported", "There was no row here that could be added."), htmlCard("Try again", pasteForm(text))] });
    }

    const rows = result.records.map((entry) => ({
      ...entry.record,
      organization_id: scope.organizationId,
      created_by: scope.userId
    }));

    const saved = await fetch(`${scope.config.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(rows)
    }).catch(() => undefined);

    if (!saved?.ok) {
      // One request, so one failure means none of them went in. Said plainly,
      // because "an error occurred" leaves somebody wondering whether to paste
      // it again and risk doubling everybody.
      return page(res, {
        status: 502,
        sections: [
          brandCard("Nothing was imported", "The whole paste is written in one go, so this failed before anything was added. Nobody has been created twice -- you can safely paste it again."),
          htmlCard("Try again", pasteForm(text))
        ]
      });
    }

    const written = await saved.json().catch(() => null);
    const count = Array.isArray(written) ? written.length : null;

    return page(res, {
      sections: [
        brandCard(
          count === null ? "Imported" : `${count} ${count === 1 ? "customer" : "customers"} added`,
          count === null
            ? "They went in, but the database did not say how many. Check your customer list against your spreadsheet."
            : (count === rows.length
              ? "Every row that could be added was added."
              : `${rows.length} were sent and the database reported ${count}. Check your customer list against your spreadsheet before pasting again.`)
        ),
        ...(result.rejected.length
          ? [htmlCard("Still not added", `<ul>${result.rejected.map((entry) => `<li><strong>Line ${entry.line}</strong>: ${escapeHtml(entry.problems.join("; "))}</li>`).join("")}</ul>`)]
          : []),
        brandCard("What next", "Open your customer list to check them, then quotes and invoices can be addressed to them.")
      ]
    });
  });
}

registerImportRoutes.CUSTOMER_FIELDS = CUSTOMER_FIELDS;
registerImportRoutes.TABLE = TABLE;

module.exports = registerImportRoutes;
