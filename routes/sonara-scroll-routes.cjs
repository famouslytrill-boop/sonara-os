"use strict";

// Making, publishing and downloading a cinematic scroll site.
//
//   GET  /creator-studio/scroll                  the sites somebody has
//   GET  /creator-studio/scroll/new              pick a template
//   POST /api/scroll-sites                       create, save, publish, unpublish, delete
//   GET  /creator-studio/scroll/:id              the editor
//   GET  /creator-studio/scroll/:id/preview      the site, exactly as it will be
//   GET  /creator-studio/scroll/:id/export.zip   the folder
//   GET  /s/:slug                                the published site, for anybody
//
// ## The resolution order on the public page
//
// `/s/:slug` is the only route here a stranger reaches, and it resolves the
// same way `/shared/:token` and `/book/:slug` do, for the same reason: reads go
// through the service-role key, which bypasses row level security, so the
// filter in the query is the entire tenant boundary. The slug finds one row
// that is published; that row names its organization; nothing else is read.
// The public request never chooses an organization.
//
// ## Preview and publish are the same document
//
// Both call `renderSite` on the output of `buildSite`, so a customer cannot
// preview one thing and publish another. The export calls the same renderer
// again through `buildExport`. Three surfaces, one renderer, on purpose --
// which is also why the preview is a full page rather than an iframe: this
// application sends `frame-ancestors 'none'`, so an iframe of its own page
// would be blank, and a preview that is blank for a reason unrelated to the
// site is a preview nobody can trust.

const fs = require("node:fs");
const path = require("node:path");

const { buildSite, MAX_SECTIONS, SECTION_KINDS, MOTIONS, FONT_SETS, COLOUR_KEYS } = require("../lib/sonara-scroll-site.cjs");
const { TEMPLATES, siteFromTemplate } = require("../lib/sonara-scroll-templates.cjs");
const { renderSite } = require("../lib/sonara-scroll-render.cjs");
const { buildExport, exportFiles, exportFilename } = require("../lib/sonara-scroll-export.cjs");
const { scrollSiteAllowance, scrollSiteLimitMessage } = require("../lib/sonara-plan-limits.cjs");
// The same ceiling the browser plans against. Required across from public/
// rather than restated here: two numbers for one limit is a page that claims
// more frames than were written, and every one of the extras is a 404.
const { MAX_FRAMES } = require("../public/sonara-frame-plan.js");

const TABLE = "scroll_sites";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Read once at startup rather than per request. It is a file in this
// deployment, it cannot change while the process is alive, and reading it on
// every export would be a disk read in a serverless function for no reason.
//
// Read eagerly and deliberately not guarded with a try: if this file is missing
// the export is broken, and finding that out at boot is better than finding it
// out from a customer whose downloaded folder loads a script that is not there.
const RUNTIME = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-scroll.js"), "utf8");

const REQUIRED = Object.freeze([
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireCustomer", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders"
]);

module.exports = function registerScrollRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerScrollRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders
  } = deps;
  // Optional: a deployment without a rate limiter still works, and the create
  // endpoint is behind a signed-in customer either way.
  const createRateLimiter = typeof deps.createRateLimiter === "function" ? deps.createRateLimiter : null;

  const enc = encodeURIComponent;

  // `response.json()`, not `response.text()`.
  //
  // Every other route in this application reads PostgREST with `.json()`, and
  // the difference is not stylistic: the test harnesses stub a response object
  // with a `json()` method and no `text()`, so a route reading text throws on
  // every request under test while working perfectly in production. That is the
  // wrong way round -- a fault the suite cannot see is a fault nobody finds.
  //
  // The reason `.text()` was tempting is that it can tell an empty body from a
  // failure, which `return=minimal` needs. The answer is not to use
  // `return=minimal`: every write below asks for the row back, so there is
  // always a body to read.
  async function rest(config, query, options = {}) {
    const response = await fetch(`${config.url}/rest/v1/${query}`, {
      headers: { ...supabaseHeaders(config), ...(options.headers || {}) },
      ...options
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const parsed = await response.json().catch(() => null);
    if (parsed === null || parsed === undefined) {
      // A successful response with nothing readable in it. Reported as ok with
      // no rows rather than as a failure: DELETE answers this way, and calling
      // a completed delete a failure would have the page say nothing happened.
      return { ok: true, rows: [], status: response.status };
    }
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [parsed], status: response.status };
  }

  function write(config, table, body, { method = "POST", query = "" } = {}) {
    return rest(config, `${table}${query}`, {
      method,
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
  }

  // Signed in, in a workspace, with a database. Every owner route starts here,
  // and each of the three failures is reported as itself rather than as one
  // generic "not available".
  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, why: "no_database" };
    const user = req.sonaraUser || req.sonaraAccess?.user || req.user || null;
    if (!user?.id) return { ok: false, why: "no_user" };
    const organization = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!organization?.ok || !organization.organizationId) return { ok: false, why: "no_workspace" };
    return {
      ok: true,
      config,
      userId: user.id,
      organizationId: organization.organizationId,
      entitlement: organization.entitlementKey || organization.planKey || "free"
    };
  }

  function unavailablePage(why) {
    const said = {
      no_database: "Your account database is not connected yet, so saved sites cannot be read.",
      no_user: "Sign in and this will open.",
      no_workspace: "We could not tell which workspace you are in. Sign in again and this will work."
    };
    return layout({
      title: "Scroll sites",
      eyebrow: "Creator Studio",
      heading: "Not available right now",
      body: said[why] || "This is not available just now.",
      sections: [],
      actions: [linkAction("/creator-studio/dashboard", "Back to Creator Studio")]
    });
  }

  // One row, scoped by organization as well as by id. The service key bypasses
  // row level security, so without the organization filter a guessed id from
  // another workspace would open.
  async function loadSite(scope, id) {
    if (!UUID.test(String(id || ""))) return { ok: false, code: "not_ours" };
    const found = await rest(
      scope.config,
      `${TABLE}?select=*&id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`
    );
    if (!found.ok) return { ok: false, code: "unreadable" };
    if (!found.rows[0]) return { ok: false, code: "not_found" };
    return { ok: true, row: found.rows[0], site: buildSite(found.rows[0].document) };
  }

  // How many sites this workspace has published. Carries `ok` through, because
  // a count that could not be read must not be treated as zero -- that reads as
  // "you have used none of your allowance" and lets somebody past a limit.
  async function publishedCount(scope) {
    const found = await rest(
      scope.config,
      `${TABLE}?select=id&organization_id=eq.${enc(scope.organizationId)}&published_at=not.is.null`
    );
    return found.ok ? { ok: true, count: found.rows.length } : { ok: false, count: null };
  }

  // ---- the dashboard ---------------------------------------------------

  app.get("/creator-studio/scroll", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.status(200).type("html").send(unavailablePage(scope.why));

    const listed = await rest(
      scope.config,
      `${TABLE}?select=id,title,slug,published_at,updated_at,template_key&organization_id=eq.${enc(scope.organizationId)}&order=updated_at.desc&limit=100`
    );

    const sections = [];
    if (!listed.ok) {
      // Not an empty dashboard. "You have no sites" is a claim about this
      // customer's own work, and a failed read has not established it.
      sections.push(brandCard(
        "We could not read your sites",
        "This is a problem on our side. Your sites are still there; nothing has been lost. Try again shortly."
      ));
    } else if (!listed.rows.length) {
      sections.push(brandCard(
        "Nothing here yet",
        "A scroll site is one page that unfolds as somebody moves down it. Start from a template and change the words."
      ));
    } else {
      sections.push(`<article class="card"><h2>Your sites</h2><ul class="sonara-site-list">${
        listed.rows.map((row) => {
          const live = row.published_at && row.slug;
          return `<li>
            <a href="/creator-studio/scroll/${escapeHtml(row.id)}"><strong>${escapeHtml(row.title || "Untitled site")}</strong></a>
            <div class="fine">${live
              ? `Published at <a href="/s/${escapeHtml(row.slug)}">/s/${escapeHtml(row.slug)}</a>`
              : "Not published"}</div>
          </li>`;
        }).join("")
      }</ul></article>`);
    }

    // The allowance, said before somebody spends time on a site they cannot
    // publish. Three states: a number, unlimited, or could not tell.
    const counted = listed.ok
      ? { ok: true, count: listed.rows.filter((row) => row.published_at && row.slug).length }
      : { ok: false, count: null };
    const allowance = scrollSiteAllowance(scope.entitlement, counted);
    if (allowance.unknown) {
      sections.push(brandCard("How many you can publish", "We could not count your published sites just now, so this does not say."));
    } else if (allowance.included !== null) {
      sections.push(brandCard(
        "How many you can publish",
        `Your plan includes ${allowance.included === 1 ? "one published site" : `${allowance.included} published sites`}, and you are using ${allowance.used}. `
        + "Downloading a site as a folder you host yourself is unlimited on every plan."
      ));
    }

    return res.status(200).type("html").send(layout({
      title: "Scroll sites",
      eyebrow: "Creator Studio",
      heading: "Scroll sites",
      body: "One page that unfolds as somebody scrolls. Publish it here, or download it and host it anywhere.",
      sections,
      actions: [
        linkAction("/creator-studio/scroll/new", "Start a new site"),
        linkAction("/creator-studio/dashboard", "Back to Creator Studio")
      ]
    }));
  });

  // ---- picking a template ----------------------------------------------

  app.get("/creator-studio/scroll/new", requireCustomer, async (req, res) => {
    const sections = TEMPLATES.map((template) => `<article class="card">
      <h2>${escapeHtml(template.name)}</h2>
      <p>${escapeHtml(template.what)}</p>
      <p class="fine">${escapeHtml(template.bestFor)}</p>
      <form method="post" action="/api/scroll-sites">
        <input type="hidden" name="action" value="create">
        <input type="hidden" name="template" value="${escapeHtml(template.key)}">
        <label>Call it<input type="text" name="title" maxlength="90" placeholder="${escapeHtml(template.name)}"></label>
        <button type="submit">Start from this</button>
      </form>
    </article>`);

    return res.status(200).type("html").send(layout({
      title: "Start a scroll site",
      eyebrow: "Creator Studio",
      heading: "Pick something to start from",
      body: "Every one of these is a finished site with real words in it. Change whatever you like; none of it is fixed.",
      sections,
      actions: [linkAction("/creator-studio/scroll", "Back to your sites")]
    }));
  });

  // ---- the editor -------------------------------------------------------

  function editorForm(row, site) {
    const colourInputs = COLOUR_KEYS.map((key) => `<label>${escapeHtml(key)}
      <input type="color" name="colour_${escapeHtml(key)}" value="${escapeHtml(site.colours[key])}">
    </label>`).join("");

    const sectionFields = site.sections.map((section, index) => `<fieldset class="sonara-section-edit">
      <legend>Section ${index + 1}</legend>
      <label>What kind
        <select name="kind_${index}">${SECTION_KINDS.map((kind) =>
          `<option value="${escapeHtml(kind)}"${kind === section.kind ? " selected" : ""}>${escapeHtml(kind)}</option>`).join("")}
        </select>
      </label>
      <label>How it arrives
        <select name="motion_${index}">${MOTIONS.map((motion) =>
          `<option value="${escapeHtml(motion)}"${motion === section.motion ? " selected" : ""}>${escapeHtml(motion)}</option>`).join("")}
        </select>
      </label>
      <label>Small label above<input type="text" name="eyebrow_${index}" maxlength="40" value="${escapeHtml(section.eyebrow)}"></label>
      <label>Heading<input type="text" name="heading_${index}" maxlength="120" value="${escapeHtml(section.heading)}"></label>
      <label>Words<textarea name="body_${index}" rows="4" maxlength="600">${escapeHtml(section.body)}</textarea></label>
      <label>Picture address<input type="url" name="image_${index}" maxlength="500" value="${escapeHtml(section.imageUrl)}"></label>
      <label>What the picture shows<input type="text" name="imagealt_${index}" maxlength="200" value="${escapeHtml(section.imageAlt)}"></label>
    </fieldset>`).join("");

    return `<article class="card"><h2>Edit</h2>
    <form method="post" action="/api/scroll-sites" class="sonara-settings-form">
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="id" value="${escapeHtml(row.id)}">
      <input type="hidden" name="section_count" value="${site.sections.length}">
      <label>Title<input type="text" name="title" maxlength="90" value="${escapeHtml(site.title)}" required></label>
      <label>Typeface
        <select name="fontSet">${FONT_SETS.map((set) =>
          `<option value="${escapeHtml(set)}"${set === site.fontSet ? " selected" : ""}>${escapeHtml(set)}</option>`).join("")}
        </select>
      </label>
      <fieldset><legend>Colours</legend>${colourInputs}</fieldset>
      <fieldset><legend>Soundtrack</legend>
        <label>Address of the audio file<input type="url" name="audio_url" maxlength="500" value="${escapeHtml(site.audio.url)}"></label>
        <label>What to call it<input type="text" name="audio_label" maxlength="40" value="${escapeHtml(site.audio.label)}"></label>
        <label><input type="checkbox" name="audio_enabled" value="true"${site.audio.enabled ? " checked" : ""}> Offer it on the page</label>
        <p class="fine">It never plays on its own. A visitor presses a button, or hears nothing.</p>
      </fieldset>
      ${sectionFields}
      <button type="submit">Save</button>
    </form></article>`;
  }

  app.get("/creator-studio/scroll/:id", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.status(200).type("html").send(unavailablePage(scope.why));

    const loaded = await loadSite(scope, req.params.id);
    if (!loaded.ok) {
      const said = {
        unreadable: "We could not read this site just now. It is still there; try again shortly.",
        not_found: "That site is not in your workspace, or it has been removed.",
        not_ours: "That site reference is not one of ours."
      };
      return res.status(loaded.code === "unreadable" ? 503 : 404).type("html").send(layout({
        title: "Scroll site",
        eyebrow: "Creator Studio",
        heading: loaded.code === "unreadable" ? "Not available right now" : "Not found",
        body: said[loaded.code],
        sections: [],
        actions: [linkAction("/creator-studio/scroll", "Back to your sites")]
      }));
    }

    const { row, site } = loaded;
    const sections = [];

    // Whatever the last write said, in words.
    //
    // Every handler above redirects back here with `?problem=...`, and until
    // this existed those codes were rendered by nothing: a customer who hit
    // their plan limit got a bare query parameter and a page that looked as
    // though the publish had simply not happened. The unused-variable warning
    // on `scrollSiteLimitMessage` is what surfaced it.
    const problem = String(req.query?.problem || "");
    if (problem) {
      const counted = await publishedCount(scope);
      const said = {
        bad_address: "That address will not work. Use lower case letters, numbers and hyphens, at least two characters.",
        address_taken: "Somebody already has that address. Try another.",
        at_limit: scrollSiteLimitMessage(scrollSiteAllowance(scope.entitlement, counted)),
        count_unknown: scrollSiteLimitMessage({ unknown: true }),
        not_saved: "That did not save. Nothing has been changed.",
        not_available: "We could not reach your records just now. Nothing has been changed.",
        no_such_template: "That template is not one of ours.",
        unknown_action: "That form did something this page does not know about. Nothing has been changed."
      };
      sections.push(brandCard("Not done", said[problem] || "That did not work. Nothing has been changed."));
    }

    // Problems with the site itself next, because they are the other reason
    // somebody would look.
    if (site.problems.length) {
      sections.push(brandCard(
        site.problems.length === 1 ? "One thing worth a look" : `${site.problems.length} things worth a look`,
        site.problems.map((problem) => problem.detail).join(" ")
      ));
    }

    const live = row.published_at && row.slug;
    sections.push(`<article class="card"><h2>${live ? "Published" : "Not published"}</h2>
      ${live
        ? `<p>Anybody with the address can open it: <a href="/s/${escapeHtml(row.slug)}">/s/${escapeHtml(row.slug)}</a></p>
           <form method="post" action="/api/scroll-sites">
             <input type="hidden" name="action" value="unpublish">
             <input type="hidden" name="id" value="${escapeHtml(row.id)}">
             <button type="submit">Stop publishing</button>
           </form>`
        : `<p>Choose an address and it goes live. You can stop publishing at any time.</p>
           <form method="post" action="/api/scroll-sites">
             <input type="hidden" name="action" value="publish">
             <input type="hidden" name="id" value="${escapeHtml(row.id)}">
             <label>Address<input type="text" name="slug" maxlength="48" placeholder="summer-launch" pattern="[a-z0-9][a-z0-9-]{1,47}" required></label>
             <p class="fine">Lower case letters, numbers and hyphens. It becomes /s/your-address.</p>
             <button type="submit">Publish</button>
           </form>`}
    </article>`);

    // Bringing your own video.
    //
    // The controls are written disabled and switched on by the script. Without
    // it -- blocked, failed, an older browser -- they would be a file picker
    // and a button that look ready and do nothing, and a dead control is worse
    // than one that says why it cannot work.
    sections.push(`<article class="card" data-frame-studio data-site-export="/creator-studio/scroll/${escapeHtml(row.id)}/export.json">
      <h2>Bring your own video</h2>
      <p>Drop a short clip in and it becomes the frames this page scrubs through as somebody scrolls. A few seconds is plenty.</p>
      <p class="fine">The clip never leaves this machine. The frames are taken here in your browser, packed with your site, and downloaded — nothing is uploaded.</p>
      <label>Your clip<input type="file" accept="video/*" disabled></label>
      <p data-frame-status role="status">Turning this on…</p>
      <canvas width="320" height="180" aria-label="The frame being taken"></canvas>
      <p><button type="button" data-frame-build disabled>Take the frames and download the folder</button></p>
    </article>`);

    sections.push(editorForm(row, site));

    return res.status(200).type("html").send(layout({
      title: `Editing ${site.title}`,
      eyebrow: "Creator Studio",
      heading: site.title,
      body: "Change the words, the colours and the order. Look at it before you publish it.",
      sections,
      scripts: ["/sonara-frame-plan.js", "/sonara-zip-core.js", "/sonara-scroll-frames.js"],
      actions: [
        linkAction(`/creator-studio/scroll/${row.id}/preview`, "See it"),
        linkAction(`/creator-studio/scroll/${row.id}/export.zip`, "Download the folder"),
        linkAction("/creator-studio/scroll", "Back to your sites")
      ]
    }));
  });

  // ---- preview -----------------------------------------------------------

  app.get("/creator-studio/scroll/:id/preview", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.status(200).type("html").send(unavailablePage(scope.why));

    const loaded = await loadSite(scope, req.params.id);
    if (!loaded.ok) return res.status(loaded.code === "unreadable" ? 503 : 404).type("text").send("That site is not available.");

    // The same renderer the published page uses. A preview drawn by anything
    // else is a preview of something else.
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).type("html").send(renderSite(loaded.site, {
      footer: `Preview. <a href="/creator-studio/scroll/${escapeHtml(loaded.row.id)}">Back to editing</a>`
    }));
  });

  // ---- the export --------------------------------------------------------

  app.get("/creator-studio/scroll/:id/export.zip", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.status(503).type("text").send("Sign in and this will download.");

    const loaded = await loadSite(scope, req.params.id);
    if (!loaded.ok) {
      return res.status(loaded.code === "unreadable" ? 503 : 404).type("text").send(
        loaded.code === "unreadable"
          ? "We could not read that site just now, so the folder would have been wrong. Nothing was produced."
          : "That site is not in your workspace."
      );
    }

    // Frames and audio are referenced by address in the document, and this
    // function does not fetch them. Stated rather than silently skipped: the
    // README inside the folder says what is and is not in it, and a site whose
    // frames live elsewhere exports as a site without frames rather than as a
    // site with broken ones.
    const { zip } = buildExport({ site: loaded.site, runtime: RUNTIME });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${exportFilename(loaded.site)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(zip);
  });

  // The export's text files, as JSON, for a browser that is holding frames.
  //
  // When somebody brings their own video the frames are extracted and zipped on
  // their machine -- a few hundred of them is far past what a serverless
  // function will accept, and there is no multipart parser here anyway. What
  // the browser cannot do is render the site: the words, the colours and the
  // markup have to be the ones this server would publish, or the folder
  // somebody downloads is a page a second renderer invented.
  //
  // So the browser asks for exactly these three files and adds the frames
  // itself. `frames` is what it is *about to write*, and the page is built to
  // scrub through that many.
  app.get("/creator-studio/scroll/:id/export.json", requireCustomer, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.status(503).json({ ok: false, detail: "Sign in and this will work." });

    const loaded = await loadSite(scope, req.params.id);
    if (!loaded.ok) {
      return res.status(loaded.code === "unreadable" ? 503 : 404).json({
        ok: false,
        detail: loaded.code === "unreadable"
          ? "We could not read that site just now, so the folder would have been wrong. Nothing was produced."
          : "That site is not in your workspace."
      });
    }

    // Bounded here as well as in the browser. The browser's plan is the one a
    // person sees; this is the one that decides what the page claims, and a
    // request asking for sixty thousand frames must not produce a page that
    // says so.
    const asked = Number(req.query?.frames);
    const frameCount = Number.isInteger(asked) && asked >= 2 && asked <= MAX_FRAMES ? asked : 0;

    return res.status(200).json({
      ok: true,
      filename: exportFilename(loaded.site),
      frames: frameCount,
      files: exportFiles({ site: loaded.site, runtime: RUNTIME, frameCount })
    });
  });

  // ---- create, save, publish, unpublish, delete ---------------------------

  // Named, windowed and scoped the way every other limiter here is. The first
  // version of this invented its own option names -- windowMs, max, key -- and
  // the module's own guard refused it at boot rather than silently rate
  // limiting nothing, which is the better failure by a long way.
  const limiter = createRateLimiter
    ? createRateLimiter({
      name: "scroll_site_write",
      windowSeconds: 3600,
      // Generous: this is one signed-in customer saving their own page, and a
      // person moving text around saves a lot. It exists to bound a script, not
      // to pace somebody working.
      maxAttempts: 240,
      scopes: ["ip", "subject"],
      subjectFrom: (req) => req.sonaraUser?.id || req.sonaraAccess?.user?.id || "",
      getSupabaseServerConfig
    })
    : (req, res, next) => next();

  app.post("/api/scroll-sites", requireCustomer, limiter, async (req, res) => {
    const scope = await scopeFor(req);
    const back = (id, problem) => {
      const target = id ? `/creator-studio/scroll/${id}` : "/creator-studio/scroll";
      return res.redirect(303, problem ? `${target}?problem=${enc(problem)}` : target);
    };
    if (!scope.ok) return back(null, "not_available");

    const action = String(req.body?.action || "");
    const id = String(req.body?.id || "");

    if (action === "create") {
      const template = siteFromTemplate(String(req.body?.template || ""));
      // Refused rather than defaulted to the first template. Somebody who
      // clicked a template and got a different one would have no idea why.
      if (!template) return back(null, "no_such_template");

      const title = String(req.body?.title || "").trim();
      const site = buildSite({ ...template, title: title || template.title });
      const created = await write(scope.config, TABLE, {
        organization_id: scope.organizationId,
        created_by: scope.userId,
        title: site.title,
        template_key: site.template,
        document: site
      });
      if (!created.ok || !created.rows[0]?.id) return back(null, "not_saved");
      return back(created.rows[0].id);
    }

    const loaded = await loadSite(scope, id);
    if (!loaded.ok) return back(null, loaded.code === "unreadable" ? "not_available" : "not_found");

    if (action === "save") {
      const count = Math.min(MAX_SECTIONS, Math.max(0, Number(req.body?.section_count) || 0));
      const sections = [];
      for (let index = 0; index < count; index += 1) {
        sections.push({
          id: loaded.site.sections[index]?.id || `s${index + 1}`,
          kind: req.body?.[`kind_${index}`],
          motion: req.body?.[`motion_${index}`],
          eyebrow: req.body?.[`eyebrow_${index}`],
          heading: req.body?.[`heading_${index}`],
          body: req.body?.[`body_${index}`],
          imageUrl: req.body?.[`image_${index}`],
          imageAlt: req.body?.[`imagealt_${index}`]
        });
      }
      const colours = {};
      for (const key of COLOUR_KEYS) colours[key] = req.body?.[`colour_${key}`];

      // Rebuilt through buildSite rather than merged into the stored document,
      // so what is written is always something the renderer can draw.
      const site = buildSite({
        ...loaded.site,
        title: req.body?.title,
        fontSet: req.body?.fontSet,
        colours,
        sections,
        audio: {
          url: req.body?.audio_url,
          label: req.body?.audio_label,
          enabled: req.body?.audio_enabled === "true"
        }
      });

      const saved = await write(scope.config, TABLE, {
        title: site.title,
        document: site,
        updated_at: new Date().toISOString()
      }, { method: "PATCH", query: `?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}` });
      return back(id, saved.ok ? null : "not_saved");
    }

    if (action === "publish") {
      const site = buildSite({ ...loaded.site, slug: req.body?.slug });
      if (!site.slug) return back(id, "bad_address");

      // The allowance is checked here and not only on the dashboard, because
      // the dashboard is a page and this is the thing that actually publishes.
      const counted = await publishedCount(scope);
      const allowance = scrollSiteAllowance(scope.entitlement, counted);
      // Already published sites do not count against publishing this one again
      // at a new address -- but this row is not published yet, so the count
      // stands as read.
      if (!allowance.allowed) return back(id, allowance.unknown ? "count_unknown" : "at_limit");

      const published = await write(scope.config, TABLE, {
        slug: site.slug,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { method: "PATCH", query: `?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}` });

      // A slug somebody else already has comes back as a unique-violation, and
      // "taken" is a different message from "did not save" -- one is somebody
      // else's site, the other is ours.
      return back(id, published.ok ? null : (published.status === 409 ? "address_taken" : "not_saved"));
    }

    if (action === "unpublish") {
      const stopped = await write(scope.config, TABLE, {
        published_at: null,
        // The slug is released too, so somebody else can have it. Keeping it
        // reserved for a site nobody is serving is a landgrab nobody asked for.
        slug: null,
        updated_at: new Date().toISOString()
      }, { method: "PATCH", query: `?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}` });
      return back(id, stopped.ok ? null : "not_saved");
    }

    if (action === "delete") {
      const removed = await rest(scope.config, `${TABLE}?id=eq.${enc(id)}&organization_id=eq.${enc(scope.organizationId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" }
      });
      return removed.ok ? back(null) : back(id, "not_saved");
    }

    return back(id, "unknown_action");
  });

  // ---- the published site ------------------------------------------------

  app.get("/s/:slug", async (req, res) => {
    const config = getSupabaseServerConfig();
    if (!config?.ok) {
      return res.status(503).type("html").send(notFoundPage("This is not available just now. Nothing is wrong with the address."));
    }

    const slug = String(req.params.slug || "");
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
      return res.status(404).type("html").send(notFoundPage("There is no site at this address."));
    }

    // The slug finds one published row; that row names its organization; the
    // document comes from it. The public request never chooses an
    // organization -- it is told one.
    const found = await rest(
      config,
      `${TABLE}?select=title,document,slug&slug=eq.${enc(slug)}&published_at=not.is.null&limit=1`
    );

    // A failed read is not a site that does not exist. 503 rather than 404, and
    // a different sentence, because one means "try again" and the other means
    // "check the address" -- and telling somebody their address is wrong when it
    // is not sends them to the person who gave it to them.
    if (!found.ok) {
      return res.status(503).type("html").send(notFoundPage("This is not available just now. Nothing is wrong with the address."));
    }
    if (!found.rows[0]) {
      return res.status(404).type("html").send(notFoundPage("There is no site at this address. It may have been unpublished."));
    }

    const site = buildSite(found.rows[0].document);
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).type("html").send(renderSite(site));
  });

  // Deliberately not the application's own layout. A published site is
  // somebody else's page on somebody else's address, and wrapping its 404 in
  // SONARA's header would put this company's branding on a stranger's broken
  // link.
  function notFoundPage(message) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;min-height:100svh;display:grid;place-items:center;background:#0b0d12;color:#e7e9ee}
main{max-width:32rem;padding:2rem;text-align:center}p{color:#9aa3b2}</style></head>
<body><main><h1>Not found</h1><p>${escapeHtml(message)}</p></main></body></html>`;
  }
};

module.exports.TABLE = TABLE;
