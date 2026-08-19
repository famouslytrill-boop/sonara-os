"use strict";

// A saved result with a link somebody outside the workspace can open.
//
// Three routes, and the split between them is the whole design:
//
//   GET  /shared               a public explainer, for whoever trims the URL
//   GET  /shared/:token        the result itself, no account, no cookie
//   POST /api/shared-results/:id/share  and .../revoke -- customer only
//
// The read side is deliberately the dumbest thing that can work: select by
// token, from one table, returning a fixed column list that contains no
// identifier of any kind. It does not resolve a session, so there is no session
// to confuse; it does not take an organization, so there is no organization to
// be told the wrong one. The write side is where the customer's identity is
// established, and it establishes it the same way every other workspace write
// does.

const {
  SHARED_SELECT_COLUMNS,
  isShareToken,
  mintShareToken,
  sharePath,
  sharedResultView
} = require("../lib/sonara-shared-results.cjs");

const TABLE = "module_outputs";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // The explainer. Somebody who receives a link and deletes the last segment
  // lands here, and the honest thing to tell them is what the page they were
  // sent actually was -- one result, published on purpose, by a person.
  app.get("/shared", (req, res) => res.status(200).type("html").send(layout({
    title: "Shared results",
    eyebrow: "SONARA One",
    heading: "Somebody shared a result with you",
    body: "A shared result is one answer from one of our free tools, published by the person who worked it out. There is nothing else behind this address.",
    surface: "marketing",
    sections: [
      brandCard("What you are looking at", "The person who made it chose to publish it and can unpublish it at any time. It shows the answer only -- not the figures it was worked out from, and nothing about their business."),
      brandCard("You can work out your own", "The same tools are free and need no account. Type your own numbers in and you get your own answer.")
    ],
    actions: [linkAction("/free-tools", "Use the free tools"), linkAction("/", "SONARA One")]
  })));

  app.get("/shared/:token", async (req, res) => {
    const token = String(req.params.token || "");
    // Checked before it reaches a query, not after. An unchecked token would be
    // interpolated into a PostgREST filter, and the empty string there matches
    // rows whose token is empty rather than none.
    if (!isShareToken(token)) return res.status(404).type("html").send(notFoundPage());

    const config = getSupabaseServerConfig();
    if (!config.ok) return res.status(503).type("html").send(layout({
      title: "Shared result",
      eyebrow: "SONARA One",
      heading: "We could not open that result",
      body: "This is on our side. The link is fine -- try it again shortly.",
      surface: "marketing",
      sections: [],
      actions: [linkAction("/free-tools", "Use the free tools")]
    }));

    const found = await rest(
      config,
      `${TABLE}?select=${SHARED_SELECT_COLUMNS.join(",")}&share_token=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    // A read that failed is not a result that does not exist, and saying "not
    // found" to somebody holding a working link would have them tell the person
    // who sent it that it was broken. Different answers for different facts.
    if (!found.ok) return res.status(503).type("html").send(layout({
      title: "Shared result",
      eyebrow: "SONARA One",
      heading: "We could not open that result",
      body: "This is on our side, and the link has not been removed. Try it again shortly.",
      surface: "marketing",
      sections: [],
      actions: [linkAction("/free-tools", "Use the free tools")]
    }));

    const view = sharedResultView(found.rows[0]);
    if (!view) return res.status(404).type("html").send(notFoundPage());

    const detail = view.lines.length
      ? `<article class="card sonara-depth"><h2>${escapeHtml(view.title)}</h2><dl class="sonara-shared-result">${view.lines
        .map((line) => `<dt>${escapeHtml(line.label)}</dt><dd>${escapeHtml(line.value)}</dd>`)
        .join("")}</dl></article>`
      : brandCard(view.title, "This result was published with no summary to show.");

    return res.status(200).type("html").send(layout({
      title: `${view.title} — shared result`,
      eyebrow: "Shared result",
      heading: view.title,
      body: view.madeOn
        ? `Worked out with the free ${view.product} tools on ${view.madeOn}, and published by the person who made it.`
        : `Worked out with the free ${view.product} tools, and published by the person who made it.`,
      surface: "marketing",
      sections: [
        detail,
        brandCard("Work out your own", `The ${view.product} tools are free and need no account. Put your own numbers in and you get your own answer.`)
      ],
      actions: [linkAction("/free-tools", "Use the free tools"), linkAction("/shared", "What is a shared result?")]
    }));
  });

  function notFoundPage() {
    // The same page for "no such token" and "revoked", on purpose. Telling the
    // difference would tell somebody guessing tokens when they had guessed one
    // that used to exist, and would tell a recipient that the person who shared
    // it has taken it back -- which is that person's news to give, not ours.
    return layout({
      title: "Shared result",
      eyebrow: "SONARA One",
      heading: "That link does not open anything",
      body: "It may have been unpublished by the person who shared it, or it may never have been a link we made.",
      surface: "marketing",
      sections: [
        brandCard("You can still work one out", "The tools that produce these results are free and need no account.")
      ],
      actions: [linkAction("/free-tools", "Use the free tools"), linkAction("/", "SONARA One")]
    });
  }

  // Turning it on, and taking it back.
  //
  // Both writes filter on organization_id as well as id. The service-role key
  // bypasses RLS, so that filter is the entire tenant boundary -- an id alone
  // would let any signed-in customer publish any other customer's result by
  // guessing a uuid.
  async function ownedRow(req) {
    const id = String(req.params.id || "");
    if (!UUID_PATTERN.test(id)) return { ok: false, status: 404, code: "unknown_result" };
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, status: 503, code: "workspace_unavailable" };
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser).catch(() => ({ ok: false }));
    if (!organization.ok || !organization.organizationId) return { ok: false, status: 409, code: "workspace_setup_required" };
    return { ok: true, id, config, organizationId: organization.organizationId };
  }

  function backHref(req) {
    const from = String(req.body?.back || "");
    // Only a path on this site, and only one that looks like a records page.
    // An open redirect is how a share button becomes a phishing link.
    return /^\/[a-z0-9/-]*$/i.test(from) && from.length <= 120 ? from : "/dashboard";
  }

  function respond(req, res, status, body, href) {
    if (wantsJson(req)) return res.status(status).json(body);
    if (body.ok) return res.redirect(303, href);
    return res.status(status).type("html").send(responsePage(
      "That did not change",
      body.message || "Nothing was published or unpublished. Try again shortly.",
      [linkAction(href, "Back to your results"), linkAction("/support", "Get help")]
    ));
  }

  app.post("/api/shared-results/:id/share", requireCustomer, async (req, res) => {
    const owned = await ownedRow(req);
    if (!owned.ok) return respond(req, res, owned.status, { ok: false, code: owned.code }, backHref(req));

    // Re-sharing a result that is already shared keeps its existing link. A new
    // token every time would silently break every copy of the old one, and
    // nothing on the page warned that pressing the button twice did that.
    const existing = await rest(
      owned.config,
      `${TABLE}?select=share_token&id=eq.${encodeURIComponent(owned.id)}&organization_id=eq.${encodeURIComponent(owned.organizationId)}&limit=1`,
      { headers: supabaseHeaders(owned.config) }
    );
    if (!existing.ok) return respond(req, res, 503, { ok: false, code: "workspace_unreadable" }, backHref(req));
    if (!existing.rows.length) return respond(req, res, 404, { ok: false, code: "unknown_result" }, backHref(req));

    const already = existing.rows[0]?.share_token;
    if (isShareToken(already)) {
      return respond(req, res, 200, { ok: true, code: "already_shared", token: already, path: sharePath(already) }, backHref(req));
    }

    const token = mintShareToken();
    const updated = await rest(
      owned.config,
      `${TABLE}?id=eq.${encodeURIComponent(owned.id)}&organization_id=eq.${encodeURIComponent(owned.organizationId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(owned.config, { prefer: "return=representation" }),
        body: JSON.stringify({ share_token: token, shared_at: new Date().toISOString() })
      }
    );
    if (!updated.ok || !updated.rows.length) {
      return respond(req, res, 503, { ok: false, code: "share_not_saved" }, backHref(req));
    }
    return respond(req, res, 200, { ok: true, code: "shared", token, path: sharePath(token) }, backHref(req));
  });

  app.post("/api/shared-results/:id/revoke", requireCustomer, async (req, res) => {
    const owned = await ownedRow(req);
    if (!owned.ok) return respond(req, res, owned.status, { ok: false, code: owned.code }, backHref(req));

    // shared_at is left alone. It records that this result was published once,
    // which is true after revoking and is what lets the page tell a customer
    // "this was public until you took it back" rather than nothing at all.
    const updated = await rest(
      owned.config,
      `${TABLE}?id=eq.${encodeURIComponent(owned.id)}&organization_id=eq.${encodeURIComponent(owned.organizationId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(owned.config, { prefer: "return=representation" }),
        body: JSON.stringify({ share_token: null })
      }
    );
    if (!updated.ok) return respond(req, res, 503, { ok: false, code: "revoke_not_saved" }, backHref(req));
    if (!updated.rows.length) return respond(req, res, 404, { ok: false, code: "unknown_result" }, backHref(req));
    return respond(req, res, 200, { ok: true, code: "revoked" }, backHref(req));
  });
}

module.exports = registerSharedResultRoutes;
