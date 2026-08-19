"use strict";

// Anything a customer chooses to show somebody outside their workspace.
//
// Four routes, and the split between them is the design:
//
//   GET  /shared                                  a public explainer
//   GET  /shared/:token                           the thing itself, no account
//   POST /api/shared-links/:resourceType/:id/share
//   POST /api/shared-links/:resourceType/:id/revoke
//
// The read side resolves in one direction only, and that order is what makes it
// safe. A token finds exactly one `shared_links` row. That row names the
// resource AND the organization that owns it. The resource is then fetched
// filtered on both, and the business name comes from that same organization.
//
// So the public page never chooses an organization -- it is told one by the row
// the customer created when they pressed Share. A page that took the
// organization from the request would be a page that could be told the wrong
// one, and the service-role key bypasses row level security, so that filter is
// the only tenant boundary there is.

const {
  SHARED_LINKS_TABLE,
  isShareToken,
  isUuid,
  mintShareToken,
  sharePath,
  shareableFor,
  sharedView
} = require("../lib/sonara-shared-results.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml", "responsePage",
  "requireCustomer", "wantsJson", "getSupabaseServerConfig", "supabaseHeaders",
  "getCustomerPrimaryOrganization"
];

function registerSharedResultRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerSharedResultRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml, responsePage,
    requireCustomer, wantsJson, getSupabaseServerConfig, supabaseHeaders,
    getCustomerPrimaryOrganization
  } = deps;

  async function rest(config, path, init) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, init).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: response?.status || 0, rows: [] };
    return { ok: true, status: response.status, rows: await response.json().catch(() => []) };
  }

  const enc = encodeURIComponent;

  function publicPage({ heading, body, sections = [], actions }) {
    return layout({
      title: heading,
      eyebrow: "SONARA One",
      heading,
      body,
      surface: "marketing",
      sections,
      actions: actions || [linkAction("/free-tools", "Use the free tools"), linkAction("/", "SONARA One")]
    });
  }

  // The same page for "no such token" and "revoked", on purpose. Telling them
  // apart would tell somebody guessing tokens when they had guessed one that
  // used to exist, and would tell a recipient that the person who shared it has
  // taken it back -- which is that person's news to give, not ours.
  function notFoundPage() {
    return publicPage({
      heading: "That link does not open anything",
      body: "It may have been unpublished by the person who shared it, or it may never have been a link we made.",
      sections: [brandCard("You can still work one out", "The tools that produce these results are free and need no account.")]
    });
  }

  // A read that failed is not a thing that does not exist. Saying "not found" to
  // somebody holding a working link would have them tell the sender it was
  // broken.
  function unavailablePage() {
    return publicPage({
      heading: "We could not open that",
      body: "This is on our side, and the link has not been removed. Try it again shortly.",
      sections: []
    });
  }

  app.get("/shared", (req, res) => res.status(200).type("html").send(publicPage({
    heading: "Somebody shared something with you",
    body: "A shared link opens one thing -- a saved result, a quote, an invoice or an appointment -- published by the person it belongs to. There is nothing else behind this address.",
    sections: [
      brandCard("What you are looking at", "The person who made it chose to publish it and can unpublish it at any time. It shows that one thing only, and never anybody's contact details."),
      brandCard("A shared page never asks you for anything", "There is no form on it. If a page claiming to be one of ours asks you for a card number or a password, it is not ours."),
      brandCard("You can work out your own", "The tools behind the saved results are free and need no account.")
    ],
    actions: [linkAction("/free-tools", "Use the free tools"), linkAction("/", "SONARA One")]
  })));

  app.get("/shared/:token", async (req, res) => {
    const token = String(req.params.token || "");
    // Checked before it reaches a query. An unchecked token is interpolated into
    // a PostgREST filter, and the empty string there matches rows whose token is
    // empty rather than none.
    if (!isShareToken(token)) return res.status(404).type("html").send(notFoundPage());

    const config = getSupabaseServerConfig();
    if (!config.ok) return res.status(503).type("html").send(unavailablePage());

    const found = await rest(
      config,
      `${SHARED_LINKS_TABLE}?select=resource_type,resource_id,organization_id&token=eq.${enc(token)}&revoked_at=is.null&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    if (!found.ok) return res.status(503).type("html").send(unavailablePage());
    const link = found.rows[0];
    if (!link) return res.status(404).type("html").send(notFoundPage());

    const shareable = shareableFor(link.resource_type);
    // A resource_type the database holds and this code does not understand. The
    // check constraint should make it impossible; answering "not found" rather
    // than throwing is what keeps it impossible-and-harmless instead of
    // impossible-until-it-happens.
    if (!shareable || !isUuid(link.resource_id)) return res.status(404).type("html").send(notFoundPage());

    const scope = `id=eq.${enc(link.resource_id)}&organization_id=eq.${enc(link.organization_id)}`;
    const [resource, organization, lines] = await Promise.all([
      rest(config, `${shareable.table}?select=${shareable.columns.join(",")}&${scope}&limit=1`, { headers: supabaseHeaders(config) }),
      rest(config, `organizations?select=name&id=eq.${enc(link.organization_id)}&limit=1`, { headers: supabaseHeaders(config) }),
      shareable.lines
        ? rest(
          config,
          `${shareable.lines.table}?select=${shareable.lines.columns.join(",")}&${shareable.lines.foreignKey}=eq.${enc(link.resource_id)}`
            + `&organization_id=eq.${enc(link.organization_id)}&order=created_at.asc`,
          { headers: supabaseHeaders(config) }
        )
        : Promise.resolve({ ok: true, rows: [] })
    ]);

    if (!resource.ok || !lines.ok) return res.status(503).type("html").send(unavailablePage());
    // The link says it exists and the row is gone: deleted since it was shared.
    // Not an outage, and not something to apologise for on our side.
    if (!resource.rows.length) return res.status(404).type("html").send(notFoundPage());

    const view = sharedView({
      resourceType: link.resource_type,
      row: resource.rows[0],
      lines: lines.rows,
      // A failed organization read loses the business name and nothing else. The
      // page is still worth showing, and "" is what sharedView treats as absent.
      organizationName: organization.ok ? organization.rows[0]?.name : ""
    });
    if (!view) return res.status(404).type("html").send(notFoundPage());

    const detail = view.lines.length
      ? `<article class="card sonara-depth"><h2>${escapeHtml(view.title)}</h2><dl class="sonara-shared-result">${view.lines
        .map((line) => `<dt>${escapeHtml(line.label)}</dt><dd>${escapeHtml(line.value)}</dd>`)
        .join("")}</dl></article>`
      : brandCard(view.title, "This was published with no detail to show.");

    const items = view.items?.length
      ? `<article class="card sonara-depth"><h2>What is on it</h2><table class="sonara-shared-items">
          <thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Each</th><th scope="col">Total</th></tr></thead>
          <tbody>${view.items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity === null ? "-" : String(item.quantity))}</td><td>${escapeHtml(item.unitPrice || "-")}</td><td>${escapeHtml(item.total || "-")}</td></tr>`).join("")}</tbody>
        </table></article>`
      : "";

    return res.status(200).type("html").send(layout({
      title: `${view.title} — shared`,
      eyebrow: view.from ? `Shared by ${view.from}` : "Shared",
      heading: view.title,
      body: view.subtitle || `A ${view.noun} published by the person it belongs to.`,
      surface: "marketing",
      sections: [detail, items, brandCard("About this page", view.footnote)].filter(Boolean),
      actions: [linkAction("/shared", "What is a shared link?"), linkAction("/free-tools", "Use the free tools")]
    }));
  });

  // ---------------------------------------------------------------------------
  // Turning it on, and taking it back
  // ---------------------------------------------------------------------------
  //
  // Both writes establish the organization from the signed-in customer's own
  // membership and then require the resource to be in it. An id alone would let
  // any signed-in customer publish any other customer's invoice by guessing a
  // uuid, and uuids in a URL are exactly what somebody guesses at.

  async function owned(req) {
    const shareable = shareableFor(req.params.resourceType);
    if (!shareable) return { ok: false, status: 404, code: "unknown_kind" };
    const id = String(req.params.id || "");
    if (!isUuid(id)) return { ok: false, status: 404, code: "unknown_record" };
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, status: 503, code: "workspace_unavailable" };
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser).catch(() => ({ ok: false }));
    if (!organization.ok || !organization.organizationId) return { ok: false, status: 409, code: "workspace_setup_required" };

    // Confirmed present in the caller's organization before any link is made.
    // Making the link first and checking after would leave a token for a record
    // the caller does not own if the check then failed.
    const exists = await rest(
      config,
      `${shareable.table}?select=id&id=eq.${enc(id)}&organization_id=eq.${enc(organization.organizationId)}&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    if (!exists.ok) return { ok: false, status: 503, code: "workspace_unreadable" };
    if (!exists.rows.length) return { ok: false, status: 404, code: "unknown_record" };
    return { ok: true, id, config, shareable, resourceType: String(req.params.resourceType), organizationId: organization.organizationId };
  }

  function backHref(req) {
    const from = String(req.body?.back || "");
    // Only a path on this site. An open redirect is how a Share button becomes a
    // phishing link.
    return /^\/[a-z0-9/-]*$/i.test(from) && from.length <= 120 ? from : "/dashboard";
  }

  function respond(req, res, status, body, href) {
    if (wantsJson(req)) return res.status(status).json(body);
    if (body.ok) return res.redirect(303, href);
    return res.status(status).type("html").send(responsePage(
      "That did not change",
      body.message || "Nothing was published or unpublished. Try again shortly.",
      [linkAction(href, "Back"), linkAction("/support", "Get help")]
    ));
  }

  app.post("/api/shared-links/:resourceType/:id/share", requireCustomer, async (req, res) => {
    const context = await owned(req);
    if (!context.ok) return respond(req, res, context.status, { ok: false, code: context.code }, backHref(req));

    // Re-sharing keeps the existing link. A new token every time would silently
    // break every copy of the old one, and nothing on the page warns that
    // pressing the button twice does that.
    const live = await rest(
      context.config,
      `${SHARED_LINKS_TABLE}?select=token&resource_type=eq.${enc(context.resourceType)}&resource_id=eq.${enc(context.id)}`
        + `&organization_id=eq.${enc(context.organizationId)}&revoked_at=is.null&limit=1`,
      { headers: supabaseHeaders(context.config) }
    );
    if (!live.ok) return respond(req, res, 503, { ok: false, code: "workspace_unreadable" }, backHref(req));
    const already = live.rows[0]?.token;
    if (isShareToken(already)) {
      return respond(req, res, 200, { ok: true, code: "already_shared", token: already, path: sharePath(already) }, backHref(req));
    }

    const token = mintShareToken();
    const created = await rest(context.config, SHARED_LINKS_TABLE, {
      method: "POST",
      headers: supabaseHeaders(context.config, { prefer: "return=representation" }),
      body: JSON.stringify({
        organization_id: context.organizationId,
        resource_type: context.resourceType,
        resource_id: context.id,
        token,
        created_by: req.sonaraUser?.id || null
      })
    });
    if (!created.ok || !created.rows.length) {
      return respond(req, res, 503, { ok: false, code: "share_not_saved" }, backHref(req));
    }
    return respond(req, res, 200, { ok: true, code: "shared", token, path: sharePath(token) }, backHref(req));
  });

  app.post("/api/shared-links/:resourceType/:id/revoke", requireCustomer, async (req, res) => {
    const context = await owned(req);
    if (!context.ok) return respond(req, res, context.status, { ok: false, code: context.code }, backHref(req));

    // The row is kept and stamped rather than deleted. A customer who unshares
    // something and later wonders whether it was ever public is owed an answer,
    // and a deleted row cannot give one.
    const updated = await rest(
      context.config,
      `${SHARED_LINKS_TABLE}?resource_type=eq.${enc(context.resourceType)}&resource_id=eq.${enc(context.id)}`
        + `&organization_id=eq.${enc(context.organizationId)}&revoked_at=is.null`,
      {
        method: "PATCH",
        headers: supabaseHeaders(context.config, { prefer: "return=representation" }),
        body: JSON.stringify({ revoked_at: new Date().toISOString() })
      }
    );
    if (!updated.ok) return respond(req, res, 503, { ok: false, code: "revoke_not_saved" }, backHref(req));
    // No live row is not a failure. Pressing Stop sharing on something already
    // private is a customer getting what they asked for.
    return respond(req, res, 200, { ok: true, code: updated.rows.length ? "revoked" : "already_private" }, backHref(req));
  });
}

module.exports = registerSharedResultRoutes;
