// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The pages behind "your profile" and "what this device may do".
//
//   GET  /account/profile              name, headline, bio, picture
//   POST /account/profile              save the three text fields
//   POST /account/profile/picture      upload one image (multipart)
//   POST /account/profile/picture/remove
//   GET  /account/profile/picture      a short-lived signed link to your own
//   GET  /account/permissions          camera, microphone, contacts, location,
//                                      motion, this device's processor, a local copy
//   POST /account/permissions          record a decision
//
// ## What replaced what
//
// `/account/profile` was served from routes/sonara-route-registry-routes.cjs and
// rendered the account's email beside a card reading "This feature works, but
// saving needs your records connected by an administrator first." There was no
// form on it, and no route in this repository had ever written
// `public.profiles.full_name`. That card is the thing this file removes: it is a
// sentence that reads as "come back later" on a page where nothing was coming.
//
// The decisions live in lib/sonara-user-profile.cjs and
// lib/sonara-device-permissions.cjs. This file reads, renders and writes.
//
// ## Two things this file must not do
//
// **It must not file a person's picture under an organization.** The avatar goes
// to `person/<user id>/avatar/...` via `personalPathFor`, and the signed-link and
// delete paths are scoped the same way by `ownerPrefix`. A profile picture under a
// workspace folder is a picture somebody loses when they change jobs.
//
// **It must not read a failed query as an empty profile.** Every read here
// carries `{ ok, rows }` and the page says "we could not read this just now"
// rather than showing empty boxes, which would invite somebody to retype what
// they had already saved.

const express = require("express");

const multipart = require("../lib/sonara-multipart.cjs");
const storage = require("../lib/sonara-file-storage.cjs");
const profiles = require("../lib/sonara-user-profile.cjs");
const permissions = require("../lib/sonara-device-permissions.cjs");

const PROFILE_PAGE = "/account/profile";
const PERMISSIONS_PAGE = "/account/permissions";

// The bucket is the one lib/sonara-ecosystem-manifest.cjs already declares and
// scripts/verify-production-schema.mjs already asserts exists. Until this file
// there was nothing writing to it.
const AVATAR_BUCKET = "avatars";

// A little over the 2 MiB the module accepts, so an oversized upload is read and
// then refused with a sentence about the size, rather than cut off by the body
// parser and reported as a broken request.
const UPLOAD_LIMIT_BYTES = profiles.AVATAR_MAX_BYTES + 64 * 1024;

function registerAccountProfileRoutes(app, deps = {}) {
  for (const name of ["layout", "brandCard", "linkAction", "responsePage", "escapeHtml", "requireCustomer", "getSupabaseServerConfig", "supabaseHeaders"]) {
    if (!deps[name]) throw new TypeError(`registerAccountProfileRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, responsePage, escapeHtml,
    requireCustomer, getSupabaseServerConfig, supabaseHeaders, createRateLimiter
  } = deps;

  const page = (res, input) => res.status(200).type("html").send(layout(input));
  const enc = encodeURIComponent;

  // Uploading is rate limited and saving text is not. An upload costs a request
  // body and a round trip to the file store; a name does not.
  const uploadLimiter = typeof createRateLimiter === "function"
    ? createRateLimiter({
      name: "account_avatar_upload",
      windowSeconds: 3600,
      maxAttempts: 20,
      // By person as well as by address. A shared office address should not use
      // up one colleague's allowance on another's, and twenty pictures an hour
      // is past any honest use of this page.
      scopes: ["ip", "subject"],
      subjectFrom: (req) => req.sonaraUser?.id,
      getSupabaseServerConfig
    })
    : (req, res, next) => next();

  /**
   * One person's profile row, as `{ ok, row }`.
   *
   * `ok: false` is carried rather than turned into `{}`, because a page that
   * cannot read your profile must not draw empty boxes over the top of what you
   * saved.
   */
  async function readProfile(user) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, row: null, reason: "setup_required" };
    let response;
    try {
      response = await fetch(
        `${config.url}/rest/v1/profiles?select=id,email,display_name,headline,bio,avatar_path&id=eq.${enc(user.id)}&limit=1`,
        { headers: supabaseHeaders(config) }
      );
    } catch {
      return { ok: false, row: null, reason: "unreachable" };
    }
    if (!response.ok) return { ok: false, row: null, reason: "rejected" };
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, row: null, reason: "unreadable" };
    return { ok: true, row: rows[0] || null };
  }

  /** This person's permission decisions, newest first, as `{ ok, rows }`. */
  async function readGrants(user) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, rows: [] };
    let response;
    try {
      response = await fetch(
        `${config.url}/rest/v1/device_permission_grants?select=capability,state,decided_at&user_id=eq.${enc(user.id)}&order=decided_at.desc&limit=200`,
        { headers: supabaseHeaders(config) }
      );
    } catch {
      return { ok: false, rows: [] };
    }
    if (!response.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, rows: [] };
    return { ok: true, rows };
  }

  /**
   * Write the profile row, creating it if this person has none.
   *
   * `on_conflict=id` with merge-duplicates, the same shape POST
   * /account/preferences already uses. The id is the authenticated user's and
   * never comes from the request body -- a profile write that took its own key
   * from a form would let somebody edit anybody.
   */
  async function saveProfile(user, fields) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, reason: "setup_required" };
    let response;
    try {
      response = await fetch(`${config.url}/rest/v1/profiles?on_conflict=id`, {
        method: "POST",
        headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ id: user.id, email: user.email || null, ...fields, updated_at: new Date().toISOString() })
      });
    } catch {
      return { ok: false, reason: "unreachable" };
    }
    return response.ok ? { ok: true } : { ok: false, reason: "rejected" };
  }

  function profileSections(req, read) {
    const row = read.row || {};
    const shown = profiles.displayName(row, req.sonaraUser || {});
    const state = profiles.profileCompleteness({ profile: read.row, readable: read.ok });

    if (!read.ok) {
      // Not an empty form. A failed read drawn as blank boxes is a page telling
      // somebody their profile is empty on the strength of a request that did
      // not happen.
      return [
        brandCard(
          "We could not read your profile just now",
          "Nothing has been changed or lost. This is a problem on our side, not something missing from your account — try again shortly."
        ),
        brandCard("Signed in as", escapeHtml(req.sonaraUser?.email || "Email address not returned."))
      ];
    }

    const nameNote = shown.source === "set"
      ? `You are shown as ${escapeHtml(shown.text)}.`
      : shown.source === "email"
        ? `You have not set a name, so you are shown as ${escapeHtml(shown.text)} — the first part of your email address.`
        : "You have not set a name, and we could not read an email address to fall back on.";

    const picture = row.avatar_path
      ? `<section class="card"><h2>Your picture</h2><p>A picture is saved. The link below is yours and works for a few minutes.</p><div class="card-actions"><a class="action" href="${PROFILE_PAGE}/picture">View your picture</a></div><form method="post" action="${PROFILE_PAGE}/picture/remove"><button type="submit">Remove picture</button></form></section>`
      : `<section class="card"><h2>Your picture</h2><p>No picture yet. ${profiles.ACCEPTED_AVATAR_TYPES.join(", ")}, up to ${profiles.AVATAR_MAX_BYTES / 1024}KB.</p></section>`;

    return [
      brandCard("How you are shown", nameNote),
      `<form class="card" method="post" action="${PROFILE_PAGE}">`
      + `<label>Name<input name="displayName" value="${escapeHtml(row.display_name || "")}" maxlength="${profiles.DISPLAY_NAME_MAX}" placeholder="How you want to be shown"></label>`
      + `<label>What you do<input name="headline" value="${escapeHtml(row.headline || "")}" maxlength="${profiles.HEADLINE_MAX}" placeholder="Plumber, Leeds"></label>`
      + `<label>About you<textarea name="bio" maxlength="${profiles.BIO_MAX}" rows="4" placeholder="A few lines somebody reading your page would want.">${escapeHtml(row.bio || "")}</textarea></label>`
      + `<p class="fine">Leaving a box empty clears it.</p>`
      + `<button type="submit">Save profile</button></form>`,
      picture,
      `<form class="card" method="post" action="${PROFILE_PAGE}/picture" enctype="multipart/form-data">`
      + `<label>Upload a picture<input type="file" name="picture" accept="${profiles.ACCEPTED_AVATAR_TYPES.join(",")}" required></label>`
      + `<p class="fine">We check what the file actually is, not what it is called.</p>`
      + `<button type="submit">Upload picture</button></form>`,
      brandCard(
        "Still to fill in",
        state.missing.length
          ? `${state.missing.join(", ")}. None of it is required.`
          : "Nothing — your profile is filled in."
      )
    ];
  }

  app.get(PROFILE_PAGE, requireCustomer, async (req, res) => {
    const read = await readProfile(req.sonaraUser);
    return page(res, {
      title: "Profile",
      eyebrow: "Your account",
      heading: "Your profile",
      body: "The name you are shown as, a line about what you do, and a picture. All of it optional, and all of it yours.",
      sections: profileSections(req, read),
      actions: [
        linkAction(PERMISSIONS_PAGE, "Device permissions"),
        linkAction("/account", "Account"),
        linkAction("/account/preferences", "Preferences")
      ]
    });
  });

  app.post(PROFILE_PAGE, requireCustomer, async (req, res) => {
    const fields = profiles.profileFieldsFrom(req.body || {});
    const saved = await saveProfile(req.sonaraUser, fields);
    if (!saved.ok) {
      return res.status(503).type("html").send(responsePage(
        "Your profile was not saved",
        "Nothing was changed. The account database is not reachable just now — your existing profile is untouched.",
        [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));
    }
    return res.status(303).set("location", PROFILE_PAGE).end();
  });

  app.post(
    `${PROFILE_PAGE}/picture`,
    requireCustomer,
    uploadLimiter,
    // The global urlencoded and json parsers skip a multipart body, so the raw
    // bytes have to be collected here before anything can read them.
    express.raw({ type: "multipart/form-data", limit: UPLOAD_LIMIT_BYTES }),
    async (req, res) => {
      const refuse = (message) => res.status(400).type("html").send(responsePage(
        "That picture was not saved", message, [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));

      let parsed;
      try {
        parsed = multipart.parse(req.body, req.headers["content-type"], {
          maxTotalBytes: UPLOAD_LIMIT_BYTES,
          maxFileBytes: UPLOAD_LIMIT_BYTES,
          maxFiles: 1
        });
      } catch {
        return refuse("We could not read that upload. Choose a picture and try again.");
      }
      const file = parsed?.files?.[0];
      if (!file) return refuse("No picture was attached.");

      const verdict = profiles.acceptAvatar({ bytes: file.bytes, filename: file.filename });
      if (!verdict.ok) return refuse(verdict.message);

      const config = getSupabaseServerConfig();
      const stored = await storage.put(
        config,
        // userId, never organizationId. lib/sonara-file-storage.cjs refuses a
        // call that names both, so this cannot quietly become a workspace file.
        { userId: req.sonaraUser.id, kind: "avatar", filename: file.filename, contentType: verdict.type, bytes: file.bytes },
        { bucket: AVATAR_BUCKET }
      );
      if (!stored.ok) {
        return res.status(503).type("html").send(responsePage(
          "That picture was not saved",
          `Your profile is unchanged. ${stored.problem || "The file store is not reachable just now."}`,
          [linkAction(PROFILE_PAGE, "Back to your profile")]
        ));
      }

      const saved = await saveProfile(req.sonaraUser, { avatar_path: stored.path });
      if (!saved.ok) {
        // The object is stored and the row is not. Say so rather than reporting
        // success: a page that says "saved" while the profile still shows no
        // picture is the signal this repository exists to stop.
        return res.status(503).type("html").send(responsePage(
          "That picture was uploaded and not attached",
          "The file reached storage and your profile could not be updated, so the picture is not showing yet. Uploading it again once the database is reachable will attach it.",
          [linkAction(PROFILE_PAGE, "Back to your profile")]
        ));
      }
      return res.status(303).set("location", PROFILE_PAGE).end();
    }
  );

  app.get(`${PROFILE_PAGE}/picture`, requireCustomer, async (req, res) => {
    const read = await readProfile(req.sonaraUser);
    if (!read.ok) {
      // Not a redirect, and not a 404. Both of those would tell somebody they
      // have no picture, which is a definite statement about their own data made
      // on the strength of a request that did not happen.
      return res.status(503).type("html").send(responsePage(
        "We could not check for your picture",
        "This is not the same as having no picture \u2014 nothing has been removed. Try again shortly.",
        [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));
    }
    if (!read.row?.avatar_path) {
      // Back to the profile, where the page says in so many words that there is
      // no picture yet and offers the upload form. A 404 here was the first
      // version and it is a dead end on somebody's own account page: correct
      // about the resource, useless to the person, and it made this the one
      // route in the signed-in crawl that did not resolve.
      return res.status(303).set("location", PROFILE_PAGE).end();
    }
    const link = await storage.signedUrl(
      getSupabaseServerConfig(),
      { userId: req.sonaraUser.id, path: read.row.avatar_path },
      { bucket: AVATAR_BUCKET }
    );
    if (!link.ok) {
      return res.status(503).type("html").send(responsePage(
        "That link could not be made",
        link.problem || "The file store is not reachable just now.",
        [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));
    }
    return res.status(303).set("location", link.url).end();
  });

  app.post(`${PROFILE_PAGE}/picture/remove`, requireCustomer, async (req, res) => {
    const read = await readProfile(req.sonaraUser);
    if (!read.ok) {
      return res.status(503).type("html").send(responsePage(
        "Nothing was removed",
        "We could not read your profile just now, so nothing was deleted.",
        [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));
    }
    if (!read.row?.avatar_path) {
      return res.status(303).set("location", PROFILE_PAGE).end();
    }
    // The row is cleared first. If the object delete fails afterwards an orphan
    // object is left behind, which costs storage; doing it the other way round
    // would leave a row pointing at a file that is gone, which puts a broken
    // link on the person's own page.
    const cleared = await saveProfile(req.sonaraUser, { avatar_path: null });
    if (!cleared.ok) {
      return res.status(503).type("html").send(responsePage(
        "Nothing was removed",
        "Your picture is still attached. The account database is not reachable just now.",
        [linkAction(PROFILE_PAGE, "Back to your profile")]
      ));
    }
    await storage.remove(
      getSupabaseServerConfig(),
      { userId: req.sonaraUser.id, path: read.row.avatar_path },
      { bucket: AVATAR_BUCKET }
    );
    return res.status(303).set("location", PROFILE_PAGE).end();
  });

  app.get("/api/account/device-permissions", requireCustomer, async (req, res) => {
    res.set("Cache-Control", "private, no-store").set("Vary", "Cookie");
    const grants = await readGrants(req.sonaraUser);
    if (!grants.ok) return res.status(503).json({ ok: false, code: "device_permissions_unreadable" });
    return res.json({
      ok: true, userId: req.sonaraUser.id,
      permissions: permissions.permissionSummary({ grants: grants.rows }).map(({ key, state, allowed }) => ({ key, state, allowed }))
    });
  });

  app.get(PERMISSIONS_PAGE, requireCustomer, async (req, res) => {
    const grants = await readGrants(req.sonaraUser);
    const summary = permissions.permissionSummary({ grants: grants.rows, readable: grants.ok });
    const label = {
      [permissions.STATE.granted]: "On",
      [permissions.STATE.denied]: "Off — you turned this off",
      [permissions.STATE.not_recorded]: "Off — you have not been asked",
      [permissions.STATE.unreadable]: "We could not read this"
    };
    const rows = summary.map((capability) => `<section class="card"><h2>${escapeHtml(capability.label)}</h2>`
      + `<p>${escapeHtml(capability.why)}</p>`
      + `<p><strong>${escapeHtml(label[capability.state])}</strong></p>`
      + `<input type="hidden" name="offered_${capability.key}" value="1" form="permission-form">`
      + `<label><input type="checkbox" name="allow_${capability.key}" value="true" form="permission-form"${capability.allowed ? " checked" : ""}> Allow ${escapeHtml(capability.label.toLowerCase())}</label>`
      + `</section>`).join("");

    return page(res, {
      title: "Device permissions",
      eyebrow: "Your account",
      heading: "What this device may do",
      body: grants.ok
        ? "Everything here is off until you turn it on, and off means off — nothing on this list is used without a yes from you. Turning one on tells us you want it; your browser will still ask you the first time it is needed."
        : "We could not read your settings just now. Nothing has been turned on, and nothing you previously chose has been changed.",
      sections: [
        ...rows.split("</section>").slice(0, -1).map((part) => `${part}</section>`),
        `<form class="card" id="permission-form" method="post" action="${PERMISSIONS_PAGE}"><p class="fine">Unticking a box records that you said no, which is different from never having been asked — we will not keep asking.</p><button type="submit">Save permissions</button></form>`
      ],
      actions: [linkAction(PROFILE_PAGE, "Your profile"), linkAction("/settings", "Device settings"), linkAction("/account", "Account")]
    });
  });

  app.post(PERMISSIONS_PAGE, requireCustomer, async (req, res) => {
    const body = req.body || {};
    const decisions = [];
    for (const capability of permissions.CAPABILITY_KEYS) {
      const state = permissions.decisionFrom(body, capability);
      // null means the form did not offer this capability at all, which is not a
      // no. Recording it as one would turn a page that lost a section into a page
      // that revoked a permission.
      if (state === null) continue;
      decisions.push({
        user_id: req.sonaraUser.id,
        capability,
        state,
        device_label: String(body.deviceLabel || "").trim().slice(0, 80) || null,
        decided_at: new Date().toISOString()
      });
    }
    if (!decisions.length) {
      return res.status(400).type("html").send(responsePage(
        "Nothing was recorded",
        "That form did not say which permissions it was asking about, so nothing was changed.",
        [linkAction(PERMISSIONS_PAGE, "Back to permissions")]
      ));
    }

    const config = getSupabaseServerConfig();
    if (!config?.ok) {
      return res.status(503).type("html").send(responsePage(
        "Nothing was recorded",
        "Your choices were not saved and nothing has changed. The account database is not reachable just now.",
        [linkAction(PERMISSIONS_PAGE, "Back to permissions")]
      ));
    }
    let response;
    try {
      response = await fetch(`${config.url}/rest/v1/device_permission_grants`, {
        method: "POST",
        headers: supabaseHeaders(config, { prefer: "return=minimal" }),
        body: JSON.stringify(decisions)
      });
    } catch {
      response = undefined;
    }
    if (!response?.ok) {
      return res.status(503).type("html").send(responsePage(
        "Nothing was recorded",
        "Your choices were not saved and nothing has changed. The account database is not reachable just now.",
        [linkAction(PERMISSIONS_PAGE, "Back to permissions")]
      ));
    }
    return res.status(303).set("location", PERMISSIONS_PAGE).end();
  });
}

module.exports = registerAccountProfileRoutes;
