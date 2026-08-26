"use strict";

// Attaching a file to a Creator Studio asset.
//
// `lib/sonara-multipart.cjs` can read an upload and `lib/sonara-file-storage.cjs`
// can store one. Until this file, nothing called either -- which is the defect
// this codebase keeps finding wearing its most flattering disguise: the
// capability is present, the tests pass, and no customer can reach it.
//
// So this is the reachable half, and it is deliberately one page rather than a
// change to the generic record renderer. A file has a state that a text field
// does not -- attached, not attached, or *stored somewhere this cannot reach* --
// and a page can say which. A row in a list cannot.
//
// ## Four things checked in this order, and the order matters
//
//   1. **The row belongs to this workspace.** Read filtered on `id` *and*
//      `organization_id`, before anything is parsed. Every read here uses the
//      service-role key, which bypasses row level security, so that filter is
//      the whole boundary.
//   2. **The upload parses.** A malformed body is refused with the reason.
//   3. **The bytes are the kind of file they claim to be.** `accept()` reads
//      magic bytes; the browser's content type is a claim.
//   4. **Storage takes it.** Only then is the row written, so a failed upload
//      never leaves a record pointing at a file that is not there.
//
// The reverse order -- write the row, then store -- produces an asset whose
// download button 404s for ever, and it is tempting because it makes the happy
// path one line shorter.

const express = require("express");

const multipart = require("../lib/sonara-multipart.cjs");
const storage = require("../lib/sonara-file-storage.cjs");

const REQUIRED = ["layout", "brandCard", "linkAction", "escapeHtml", "requireCustomer", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders"];

const TABLE = "creator_assets";
const BACK = "/creator-studio/assets";

// What a creator may attach. Audio is here because the Whisper adapter can
// transcribe it; a PDF because a licence or a release form is the other thing
// creators are asked for constantly.
const ALLOWED = Object.freeze(["image/jpeg", "image/png", "image/webp", "image/gif", "audio/wav", "audio/mpeg", "audio/mp4", "application/pdf"]);

// Bigger than a photo, smaller than a film. The parser is handed the same
// number, so a body over it is refused before any of it is copied.
const MAX_BYTES = 12 * 1024 * 1024;

function kindOf(type) {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  return "document";
}

function readableSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = function registerAssetFileRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerAssetFileRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders
  } = deps;

  const enc = encodeURIComponent;

  // `.json()`, like every other PostgREST read here. The test harnesses stub a
  // response with `json()` and no `text()`, so a route reading text throws
  // under test and works in production -- the wrong way round.
  async function rest(config, query, options = {}) {
    const response = await fetch(`${config.url}/rest/v1/${query}`, {
      headers: { ...supabaseHeaders(config), ...(options.headers || {}) },
      ...options
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const parsed = await response.json().catch(() => null);
    if (parsed === null || parsed === undefined) return { ok: true, rows: [], status: response.status };
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [parsed], status: response.status };
  }

  /**
   * The asset, if it is this customer's.
   *
   * Filtered on both the id and the organization in one query rather than
   * fetched and then checked -- a fetch-then-check leaves a window where
   * somebody edits the check away and the query still looks right.
   */
  async function findAsset(req, id) {
    const config = getSupabaseServerConfig();
    if (!config?.url) return { ok: false, code: "setup_required" };

    // Takes the *user*, and answers `{ ok, organizationId }` rather than an id.
    // Passing `req` and using the result as a string produces a query filtered
    // on `organization_id=eq.[object Object]`, which returns no rows -- so the
    // page says "that asset is not on your list" and looks like a working
    // boundary. Caught by reading the helper rather than by a test.
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    const organization = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!organization?.ok || !organization.organizationId) return { ok: false, code: "organization_setup_required" };
    const organizationId = organization.organizationId;

    const found = await rest(config, `${TABLE}?select=id,title,metadata&id=eq.${enc(id)}&organization_id=eq.${enc(organizationId)}&limit=1`);
    if (!found.ok) return { ok: false, code: "unreadable" };
    if (!found.rows.length) return { ok: false, code: "not_found" };
    return { ok: true, config, organizationId, row: found.rows[0] };
  }

  function storedOn(row) {
    const held = row?.metadata && row.metadata.storage;
    return held && typeof held.path === "string" && held.path ? held : null;
  }

  async function writeStorage(config, organizationId, row, value) {
    const metadata = { ...(row.metadata || {}) };
    if (value) metadata.storage = value;
    else delete metadata.storage;
    return rest(config, `${TABLE}?id=eq.${enc(row.id)}&organization_id=eq.${enc(organizationId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ metadata, updated_at: new Date().toISOString() })
    });
  }

  function page(res, status, title, body) {
    return res.status(status).type("html").send(layout(title, body));
  }

  function problemPage(res, status, title, message) {
    return page(res, status, title, brandCard(title, message, [linkAction(BACK, "Back to your assets")]));
  }

  // --- the page --------------------------------------------------------

  app.get("/creator-studio/assets/:id/file", requireCustomer, async (req, res) => {
    const found = await findAsset(req, req.params.id);
    if (!found.ok) {
      if (found.code === "not_found") return problemPage(res, 404, "No such asset", "That asset is not on your list.");
      if (found.code === "unreadable") {
        // Not "no file attached". A read that did not happen is not a record
        // with nothing in it, and offering an upload form over an unknown state
        // invites somebody to overwrite something they cannot see.
        return problemPage(res, 503, "Could not check that asset", "Your assets could not be read just now, so this cannot say whether a file is attached. Try again shortly.");
      }
      return problemPage(res, 200, "Set up your workspace first", "Finish setting up your workspace and this page will work.");
    }

    const readiness = storage.storageReadiness(found.config);
    const held = storedOn(found.row);
    const title = escapeHtml(String(found.row.title || "this asset"));

    const attached = held
      ? `<article class="card">
          <h2>Attached</h2>
          <p>${escapeHtml(held.filename || "A file")} &mdash; ${escapeHtml(held.type || "unknown type")}, ${escapeHtml(readableSize(held.bytes))}.</p>
          <p><a href="/creator-studio/assets/${escapeHtml(found.row.id)}/file/open">Open it</a>. The link lasts a few minutes and then stops working, which is why there is no address to copy.</p>
          <form method="post" action="/creator-studio/assets/${escapeHtml(found.row.id)}/file/remove">
            <button type="submit">Remove this file</button>
          </form>
        </article>`
      : `<article class="card"><h2>Nothing attached yet</h2><p>Choose a file below.</p></article>`;

    const form = readiness.ok
      ? `<article class="card">
          <h2>${held ? "Replace it" : "Attach a file"}</h2>
          <form method="post" action="/creator-studio/assets/${escapeHtml(found.row.id)}/file" enctype="multipart/form-data">
            <label>File<input type="file" name="file" required></label>
            <p class="fine">Photographs, audio or a PDF, up to ${escapeHtml(readableSize(MAX_BYTES))}. The file is checked by what is actually in it, not by its name.</p>
            <button type="submit">Attach</button>
          </form>
        </article>`
      : brandCard("Uploads are not switched on yet", readiness.detail, [linkAction("/support", "Get help")]);

    return page(res, 200, `File for ${title}`,
      `${brandCard(`File for ${title}`, "One file per asset. It is stored privately and shown to nobody but you.", [linkAction(BACK, "Back to your assets")])}${attached}${form}`);
  });

  // --- receiving one ---------------------------------------------------

  app.post(
    "/creator-studio/assets/:id/file",
    requireCustomer,
    // The global urlencoded and json parsers skip a multipart body and leave
    // the stream unread, so this route asks for the raw bytes itself. The limit
    // is here as well as in the parser: the parser cannot refuse what express
    // has already buffered.
    express.raw({ type: "multipart/form-data", limit: MAX_BYTES }),
    async (req, res) => {
      const found = await findAsset(req, req.params.id);
      if (!found.ok) {
        if (found.code === "not_found") return problemPage(res, 404, "No such asset", "That asset is not on your list.");
        return problemPage(res, 503, "Could not attach that", "Your assets could not be read just now, so nothing was changed.");
      }

      const readiness = storage.storageReadiness(found.config);
      if (!readiness.ok) return problemPage(res, 503, "Uploads are not switched on yet", readiness.detail);

      const parsed = multipart.parse(req.body, req.headers["content-type"], { maxTotalBytes: MAX_BYTES, maxFileBytes: MAX_BYTES, maxFiles: 1 });
      if (!parsed.ok) return problemPage(res, 400, "That upload could not be read", parsed.problem);
      if (!parsed.files.length) return problemPage(res, 400, "No file was chosen", "Pick a file and try again.");

      const file = parsed.files[0];
      const verdict = multipart.accept(file, ALLOWED);
      if (!verdict.ok) return problemPage(res, 415, "That kind of file is not accepted", verdict.problem);

      const stored = await storage.put(found.config, {
        organizationId: found.organizationId,
        kind: kindOf(verdict.type),
        filename: file.filename,
        contentType: verdict.type,
        bytes: file.bytes
      }, { readiness });
      if (!stored.ok) return problemPage(res, 502, "That file could not be stored", stored.problem);

      const written = await writeStorage(found.config, found.organizationId, found.row, {
        path: stored.path,
        bytes: stored.bytes,
        type: verdict.type,
        filename: file.filename,
        at: new Date().toISOString()
      });
      if (!written.ok) {
        // The bytes are in the bucket and the row does not point at them. Said
        // plainly rather than reported as a success: the file is not lost, and
        // pretending the attachment worked would leave somebody looking for it
        // on a page that will never show it.
        return problemPage(res, 502, "The file was stored but not attached",
          "The file uploaded and the asset could not be updated, so it is not showing here. Try attaching it again.");
      }

      // Replacing a file removes the one it replaced. Leaving it would grow the
      // bucket with objects nothing points at and nobody can find.
      const previous = storedOn(found.row);
      if (previous && previous.path !== stored.path) {
        await storage.remove(found.config, { organizationId: found.organizationId, path: previous.path });
      }

      return res.redirect(303, `/creator-studio/assets/${enc(found.row.id)}/file`);
    }
  );

  // --- handing one back ------------------------------------------------

  app.get("/creator-studio/assets/:id/file/open", requireCustomer, async (req, res) => {
    const found = await findAsset(req, req.params.id);
    if (!found.ok) return problemPage(res, 404, "No such file", "That file is not on your list.");

    const held = storedOn(found.row);
    if (!held) return problemPage(res, 404, "Nothing attached", "There is no file on this asset.");

    const signed = await storage.signedUrl(found.config, { organizationId: found.organizationId, path: held.path });
    if (!signed.ok) return problemPage(res, 502, "That file could not be opened", signed.problem);

    // Private and no-store: a shared cache in front of this must not keep a
    // signed link, and the redirect target is a credential for as long as it
    // lasts.
    res.set("Cache-Control", "private, no-store");
    return res.redirect(302, signed.url);
  });

  app.post("/creator-studio/assets/:id/file/remove", requireCustomer, async (req, res) => {
    const found = await findAsset(req, req.params.id);
    if (!found.ok) return problemPage(res, 404, "No such asset", "That asset is not on your list.");

    const held = storedOn(found.row);
    if (!held) return res.redirect(303, `/creator-studio/assets/${enc(found.row.id)}/file`);

    const removed = await storage.remove(found.config, { organizationId: found.organizationId, path: held.path });
    if (!removed.ok) {
      // The row keeps pointing at the object. A record that says "no file"
      // while the object is still in the bucket is worse than one that admits
      // the delete did not happen.
      return problemPage(res, 502, "That file could not be removed", removed.problem);
    }

    const written = await writeStorage(found.config, found.organizationId, found.row, null);
    if (!written.ok) return problemPage(res, 502, "The file was removed but the asset still lists it", "The file is gone from storage and the asset could not be updated. Reload this page shortly.");

    return res.redirect(303, `/creator-studio/assets/${enc(found.row.id)}/file`);
  });
};

module.exports.ALLOWED = ALLOWED;
module.exports.MAX_BYTES = MAX_BYTES;
module.exports.TABLE = TABLE;
