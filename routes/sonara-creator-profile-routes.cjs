"use strict";

// A creator profile anybody can open, and the people who follow it.
//
//   GET  /creator/:handle                        the profile, no account needed
//   GET  /account/following                      what a signed-in person follows
//   POST /api/creator-profiles/:id/publish       give it a public address
//   POST /api/creator-profiles/:id/unpublish     take it back
//   POST /api/creator-profiles/:id/follow        and /unfollow
//
// ## The read is by handle and by nothing else
//
// Same rule as the shared links: creator_artist_profiles is read with the
// service-role key, which bypasses row level security, so the filter in the
// query is the only boundary. The public page filters on `public_handle`, which
// is globally unique and NULL until the owner sets it. There is no organization
// in that query because a stranger has none, and a page that took one from the
// request would be a page that could be told the wrong one.
//
// ## What the page does not publish
//
// Six jsonb columns on that table are the artist's working material, and
// voice_identity and prompt_rules are the ones that matter: publishing them
// hands somebody the instructions for reproducing an artist's voice, which is
// the anti-clone rule in AGENTS.md rather than a preference. The select is the
// reviewed list in lib/sonara-creator-profiles.cjs and nothing else.

const {
  NEVER_PUBLISHED_COLUMNS,
  PUBLIC_PROFILE_COLUMNS,
  checkHandle,
  profilePath,
  publicProfileView
} = require("../lib/sonara-creator-profiles.cjs");

const PROFILE_TABLE = "creator_artist_profiles";
const FOLLOW_TABLE = "creator_follows";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml", "responsePage",
  "requireCustomer", "resolveCustomerSession", "wantsJson",
  "getSupabaseServerConfig", "supabaseHeaders", "getCustomerPrimaryOrganization"
];

function registerCreatorProfileRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerCreatorProfileRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml, responsePage,
    requireCustomer, resolveCustomerSession, wantsJson,
    getSupabaseServerConfig, supabaseHeaders, getCustomerPrimaryOrganization
  } = deps;

  const enc = encodeURIComponent;

  async function rest(config, path, init) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, init).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: response?.status || 0, rows: [], headers: null };
    return { ok: true, status: response.status, rows: await response.json().catch(() => []), headers: response.headers };
  }

  // An exact count without pulling the rows. PostgREST puts it in Content-Range,
  // and a failed read returns null rather than 0 -- "nobody follows this" and
  // "we could not count" are different sentences and the page says the right one.
  async function followerCount(config, profileId) {
    const response = await fetch(
      `${config.url}/rest/v1/${FOLLOW_TABLE}?select=id&artist_profile_id=eq.${enc(profileId)}&limit=1`,
      { headers: supabaseHeaders(config, { prefer: "count=exact" }) }
    ).catch(() => undefined);
    if (!response?.ok) return null;
    const range = response.headers?.get?.("content-range") || "";
    const match = range.match(/\/(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function publicPage({ heading, body, sections = [], actions }) {
    return layout({
      title: heading,
      eyebrow: "SONARA One",
      heading,
      body,
      surface: "marketing",
      sections,
      actions: actions || [linkAction("/creator-studio", "Creator Studio"), linkAction("/", "SONARA One")]
    });
  }

  function noProfilePage() {
    return publicPage({
      heading: "That page does not open anything",
      body: "This address may never have been taken, or the person who had it has made their profile private again.",
      sections: [brandCard("Creator Studio", "Creators use this to organize, protect, publish and grow their work.")]
    });
  }

  app.get("/creator/:handle", async (req, res) => {
    // Checked before it reaches a query. Anything failing this is not a handle
    // that exists, and an unchecked value goes straight into a PostgREST filter.
    const checked = checkHandle(req.params.handle);
    if (!checked.ok) return res.status(404).type("html").send(noProfilePage());

    const config = getSupabaseServerConfig();
    if (!config.ok) return res.status(503).type("html").send(publicPage({
      heading: "We could not open that profile",
      body: "This is on our side. The address is fine -- try again shortly.",
      sections: []
    }));

    const found = await rest(
      config,
      `${PROFILE_TABLE}?select=${PUBLIC_PROFILE_COLUMNS.join(",")}&public_handle=eq.${enc(checked.handle)}&status=eq.active&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    // A read that failed is not a profile that does not exist. Saying "no such
    // page" during an outage tells a creator their link is broken.
    if (!found.ok) return res.status(503).type("html").send(publicPage({
      heading: "We could not open that profile",
      body: "This is on our side, and nothing has been removed. Try again shortly.",
      sections: []
    }));
    if (!found.rows.length) return res.status(404).type("html").send(noProfilePage());

    const view = publicProfileView(found.rows[0], await followerCount(config, found.rows[0].id));
    if (!view) return res.status(404).type("html").send(noProfilePage());

    // Whether the person looking is already following. Resolved without
    // requiring a session: a stranger sees the profile and an invitation to make
    // an account, and neither costs them a redirect.
    const session = await resolveCustomerSession(req, res).catch(() => ({ ok: false }));
    const viewer = session.ok ? session.user : null;
    let followState = { signedIn: Boolean(viewer), following: false, known: true };
    if (viewer?.id) {
      const mine = await rest(
        config,
        `${FOLLOW_TABLE}?select=id&artist_profile_id=eq.${enc(found.rows[0].id)}&follower_user_id=eq.${enc(viewer.id)}&limit=1`,
        { headers: supabaseHeaders(config) }
      );
      followState = { signedIn: true, following: mine.ok && mine.rows.length > 0, known: mine.ok };
    }

    return res.status(200).type("html").send(layout({
      title: view.name,
      eyebrow: "Creator",
      heading: view.name,
      body: view.description || `${view.name} on SONARA One.`,
      surface: "marketing",
      sections: [
        brandCard("Followers", view.followers.sentence),
        followCard(found.rows[0].id, followState, view, escapeHtml)
      ],
      actions: [linkAction("/creator-studio", "Creator Studio"), linkAction("/", "SONARA One")]
    }));
  });

  // Three states, and the third is the one worth having. A follow check that
  // failed is not a person who is not following: offering Follow to somebody who
  // already does would record nothing and look broken, and hiding Unfollow would
  // trap them.
  function followCard(profileId, state, view, escape) {
    const base = `/api/creator-profiles/${encodeURIComponent(profileId)}`;
    if (!state.signedIn) {
      return `<article class="card sonara-depth"><h2>Follow ${escape(view.name)}</h2>
        <p>Following keeps this profile on your list. It is free, and it sends you nothing until you ask it to.</p>
        <div class="card-actions">${linkAction("/signup", "Create a free account")}${linkAction("/login", "Sign in")}</div>
      </article>`;
    }
    if (!state.known) {
      return brandCard(`Follow ${view.name}`, "We could not check whether you already follow this. Nothing has changed -- open the page again shortly.");
    }
    if (state.following) {
      return `<article class="card sonara-depth"><h2>You follow ${escape(view.name)}</h2>
        <p>They are on your list at <a href="/account/following">the people you follow</a>. Following sends you nothing until you ask it to.</p>
        <form method="post" action="${escape(`${base}/unfollow`)}"><button type="submit">Stop following</button></form>
      </article>`;
    }
    return `<article class="card sonara-depth"><h2>Follow ${escape(view.name)}</h2>
      <p>Keep this profile on your list. Following sends you nothing until you ask it to.</p>
      <form method="post" action="${escape(`${base}/follow`)}"><button type="submit">Follow</button></form>
    </article>`;
  }

  // What a signed-in person follows. The other half of the graph, and the reason
  // creator_follows is not a table nothing reads.
  app.get("/account/following", requireCustomer, async (req, res) => {
    const config = getSupabaseServerConfig();
    if (!config.ok) {
      return res.status(200).type("html").send(layout({
        title: "People you follow",
        eyebrow: "Your account",
        heading: "People you follow",
        body: "Your account database is not connected yet, so this list cannot load.",
        sections: [],
        actions: [linkAction("/account", "Your account")]
      }));
    }

    // Two reads rather than an embed. creator_follows has no declared foreign
    // key PostgREST can traverse into creator_artist_profiles from a filter on
    // follower_user_id, and a join written by hand here would be a second place
    // the published-column list could drift from.
    const follows = await rest(
      config,
      `${FOLLOW_TABLE}?select=artist_profile_id,created_at&follower_user_id=eq.${enc(req.sonaraUser.id)}&order=created_at.desc&limit=200`,
      { headers: supabaseHeaders(config) }
    );
    if (!follows.ok) {
      // A failed read renders as a failed read, never as an empty list. An empty
      // page here is a sentence: it says you follow nobody.
      return res.status(200).type("html").send(layout({
        title: "People you follow",
        eyebrow: "Your account",
        heading: "People you follow",
        body: "We could not load your list just now. Nothing has changed -- try again shortly.",
        sections: [],
        actions: [linkAction("/account", "Your account")]
      }));
    }

    const ids = follows.rows.map((row) => row.artist_profile_id).filter(Boolean);
    let profiles = { ok: true, rows: [] };
    if (ids.length) {
      profiles = await rest(
        config,
        `${PROFILE_TABLE}?select=${PUBLIC_PROFILE_COLUMNS.join(",")}&id=in.(${enc(ids.map((id) => `"${id}"`).join(","))})`,
        { headers: supabaseHeaders(config) }
      );
    }

    const cards = profiles.ok && profiles.rows.length
      ? profiles.rows
        .filter((row) => row.public_handle)
        .map((row) => `<article class="card"><h3><a href="${escapeHtml(profilePath(row.public_handle) || "#")}">${escapeHtml(row.artist_name || "Creator")}</a></h3>`
          + `${row.public_description ? `<p>${escapeHtml(String(row.public_description).slice(0, 300))}</p>` : ""}`
          + `<form method="post" action="${escapeHtml(`/api/creator-profiles/${encodeURIComponent(row.id)}/unfollow`)}">`
          + `<input type="hidden" name="back" value="/account/following"><button type="submit">Stop following</button></form></article>`)
        .join("")
      : "";

    const body = !ids.length
      ? "Following a creator keeps their profile on this list. It sends you nothing until you ask it to."
      : profiles.ok
        ? "Everyone you follow. Following sends you nothing until you ask it to."
        : "We could not load the profiles behind your list just now. Nothing has changed -- try again shortly.";

    return res.status(200).type("html").send(layout({
      title: "People you follow",
      eyebrow: "Your account",
      heading: "People you follow",
      body,
      sections: [cards].filter(Boolean),
      actions: [linkAction("/account", "Your account"), linkAction("/creator-studio", "Creator Studio")]
    }));
  });

  // -------------------------------------------------------------------------
  // Publishing, and following
  // -------------------------------------------------------------------------

  function backHref(req, fallback) {
    const from = String(req.body?.back || "");
    // Only a path on this site. An open redirect is how a Follow button becomes
    // a phishing link.
    return /^\/[a-z0-9/_-]*$/i.test(from) && from.length <= 120 ? from : fallback;
  }

  function respond(req, res, status, body, href) {
    if (wantsJson(req)) return res.status(status).json(body);
    if (body.ok) return res.redirect(303, href);
    return res.status(status).type("html").send(responsePage(
      "That did not change",
      body.message || "Nothing has changed. Try again shortly.",
      [linkAction(href, "Back"), linkAction("/support", "Get help")]
    ));
  }

  // Publishing is the owner's decision about their own profile, so the row has
  // to be in their organization. Following is anybody's decision about somebody
  // else's published profile, so it does not.
  async function ownProfile(req) {
    const id = String(req.params.id || "");
    if (!UUID_PATTERN.test(id)) return { ok: false, status: 404, code: "unknown_profile" };
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, status: 503, code: "workspace_unavailable" };
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser).catch(() => ({ ok: false }));
    if (!organization.ok || !organization.organizationId) return { ok: false, status: 409, code: "workspace_setup_required" };
    const found = await rest(
      config,
      `${PROFILE_TABLE}?select=id&id=eq.${enc(id)}&organization_id=eq.${enc(organization.organizationId)}&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    if (!found.ok) return { ok: false, status: 503, code: "workspace_unreadable" };
    if (!found.rows.length) return { ok: false, status: 404, code: "unknown_profile" };
    return { ok: true, id, config, organizationId: organization.organizationId };
  }

  app.post("/api/creator-profiles/:id/publish", requireCustomer, async (req, res) => {
    const back = backHref(req, "/creator-studio/artists");
    const owned = await ownProfile(req);
    if (!owned.ok) return respond(req, res, owned.status, { ok: false, code: owned.code }, back);

    const checked = checkHandle(req.body?.handle);
    if (!checked.ok) return respond(req, res, 400, { ok: false, code: checked.code, message: checked.message }, back);

    const updated = await rest(
      owned.config,
      `${PROFILE_TABLE}?id=eq.${enc(owned.id)}&organization_id=eq.${enc(owned.organizationId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(owned.config, { prefer: "return=representation" }),
        body: JSON.stringify({ public_handle: checked.handle, published_at: new Date().toISOString() })
      }
    );
    // The unique index is what decides whether a handle is free, not a check
    // beforehand. Two people submitting the same handle at the same moment would
    // both pass a check-then-write and one would silently overwrite the other.
    if (!updated.ok) {
      return respond(req, res, 409, {
        ok: false,
        code: "handle_taken",
        message: "That address is not available. Try another one."
      }, back);
    }
    if (!updated.rows.length) return respond(req, res, 404, { ok: false, code: "unknown_profile" }, back);
    return respond(req, res, 200, { ok: true, code: "published", handle: checked.handle, path: profilePath(checked.handle) }, back);
  });

  app.post("/api/creator-profiles/:id/unpublish", requireCustomer, async (req, res) => {
    const back = backHref(req, "/creator-studio/artists");
    const owned = await ownProfile(req);
    if (!owned.ok) return respond(req, res, owned.status, { ok: false, code: owned.code }, back);

    // The handle is released, and published_at is kept. It is the record that
    // this profile was public once, which is what lets the page say so rather
    // than showing a form that looks untouched.
    const updated = await rest(
      owned.config,
      `${PROFILE_TABLE}?id=eq.${enc(owned.id)}&organization_id=eq.${enc(owned.organizationId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(owned.config, { prefer: "return=representation" }),
        body: JSON.stringify({ public_handle: null })
      }
    );
    if (!updated.ok) return respond(req, res, 503, { ok: false, code: "unpublish_not_saved" }, back);
    return respond(req, res, 200, { ok: true, code: updated.rows.length ? "unpublished" : "already_private" }, back);
  });

  // Only a published profile can be followed. Without that check, a uuid guessed
  // from anywhere would create a follow of a private profile, and the follower
  // count on a page nobody can open is a number with no meaning.
  async function publishedProfile(config, id) {
    if (!UUID_PATTERN.test(String(id || ""))) return { ok: false, status: 404, code: "unknown_profile" };
    const found = await rest(
      config,
      `${PROFILE_TABLE}?select=id,public_handle&id=eq.${enc(id)}&status=eq.active&limit=1`,
      { headers: supabaseHeaders(config) }
    );
    if (!found.ok) return { ok: false, status: 503, code: "profile_unreadable" };
    // "Published" is decided here rather than by a `not.is.null` filter. The
    // filter would work, and reading the column back and deciding in code is one
    // fewer piece of PostgREST syntax between the rule and somebody checking it
    // -- which matters because this is the rule that stops a guessed uuid
    // creating a follow of a profile nobody can open.
    const handle = String(found.rows[0]?.public_handle || "").trim();
    if (!handle) return { ok: false, status: 404, code: "unknown_profile" };
    return { ok: true, handle };
  }

  app.post("/api/creator-profiles/:id/follow", requireCustomer, async (req, res) => {
    const config = getSupabaseServerConfig();
    if (!config.ok) return respond(req, res, 503, { ok: false, code: "workspace_unavailable" }, backHref(req, "/account/following"));
    const profile = await publishedProfile(config, req.params.id);
    const back = backHref(req, profile.ok ? profilePath(profile.handle) || "/account/following" : "/account/following");
    if (!profile.ok) return respond(req, res, profile.status, { ok: false, code: profile.code }, back);

    // on_conflict on the unique pair, so pressing Follow twice -- or twice at
    // once from two tabs -- is one follow rather than an error or a double count.
    const created = await rest(config, `${FOLLOW_TABLE}?on_conflict=artist_profile_id,follower_user_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({ artist_profile_id: req.params.id, follower_user_id: req.sonaraUser.id })
    });
    if (!created.ok) return respond(req, res, 503, { ok: false, code: "follow_not_saved" }, back);
    return respond(req, res, 200, { ok: true, code: "following" }, back);
  });

  app.post("/api/creator-profiles/:id/unfollow", requireCustomer, async (req, res) => {
    const config = getSupabaseServerConfig();
    const back = backHref(req, "/account/following");
    if (!config.ok) return respond(req, res, 503, { ok: false, code: "workspace_unavailable" }, back);
    if (!UUID_PATTERN.test(String(req.params.id || ""))) return respond(req, res, 404, { ok: false, code: "unknown_profile" }, back);

    // Filtered on the follower as well as the profile. Without it, one signed-in
    // person could delete another's follow by guessing a profile id.
    const removed = await rest(
      config,
      `${FOLLOW_TABLE}?artist_profile_id=eq.${enc(req.params.id)}&follower_user_id=eq.${enc(req.sonaraUser.id)}`,
      { method: "DELETE", headers: supabaseHeaders(config, { prefer: "return=representation" }) }
    );
    if (!removed.ok) return respond(req, res, 503, { ok: false, code: "unfollow_not_saved" }, back);
    // Nothing to remove is somebody getting what they asked for, not a failure.
    return respond(req, res, 200, { ok: true, code: removed.rows.length ? "unfollowed" : "was_not_following" }, back);
  });

  // Exported so a test can assert the reviewed column list is what the route
  // uses, rather than a select spelled inline that would drift from it.
  registerCreatorProfileRoutes.PUBLIC_PROFILE_COLUMNS = PUBLIC_PROFILE_COLUMNS;
  registerCreatorProfileRoutes.NEVER_PUBLISHED_COLUMNS = NEVER_PUBLISHED_COLUMNS;
}

module.exports = registerCreatorProfileRoutes;
