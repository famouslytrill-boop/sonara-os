"use strict";

// Turning the second factor on, and standing between a correct password and a
// session.
//
// `lib/sonara-two-factor.cjs` is the flow and has no idea what a request is.
// This is the part that owns the pages, the cookie carrying a half-finished
// sign-in, and the one hook in `/auth/login` that makes any of it matter.
//
// ## The hook is the feature
//
// Everything else here -- the QR code, the recovery codes, the settings page --
// is enrolment. None of it is a second factor. What makes it one is
// `holdForSecondFactor`, called between Supabase saying the password was right
// and this application setting the session cookie. Without that call the code
// prompt is a page somebody can close.

const twoFactor = require("../lib/sonara-two-factor.cjs");
const secretBox = require("../lib/sonara-secret-box.cjs");
const { encode: encodeQr } = require("../lib/sonara-qr.cjs");
const { toSvg: qrToSvg } = require("../lib/sonara-qr-png.cjs");

// The cookie carrying a half-finished sign-in.
//
// A cookie rather than a query parameter, because a challenge id in a URL is in
// the browser history, in the referrer of anything the page loads, and in every
// access log between here and the person. It grants nothing on its own -- the
// session it stands for is sealed in a row -- but it is still a credential for
// the length of its five minutes.
const CHALLENGE_COOKIE = "sonara_2fa_challenge";

const REQUIRED = Object.freeze([
  "layout",
  "brandCard",
  "linkAction",
  "escapeHtml",
  "requireCustomer",
  "getSupabaseServerConfig",
  "supabaseHeaders",
  "getEnv",
  "verifySupabaseAccessToken",
  "sendEmailAuthResult"
]);

function registerTwoFactorRoutes(app, deps = {}) {
  // Refused rather than partially registered. A settings page that renders
  // while the thing behind it cannot write is a page that tells somebody their
  // account is protected when it is not.
  const missing = REQUIRED.filter((name) => typeof deps[name] !== "function");
  if (missing.length) return { ok: false, code: "missing_dependencies", missing };

  const { layout, brandCard, linkAction, escapeHtml, requireCustomer, getSupabaseServerConfig, supabaseHeaders, getEnv, verifySupabaseAccessToken, sendEmailAuthResult } = deps;
  const acceptsHtml = (req) => String(req.headers?.accept || "").includes("text/html");
  const key = () => secretBox.keyFrom((names) => getEnv(names));

  // PostgREST, in the four shapes lib/sonara-two-factor.cjs asks for.
  const store = {
    async list(table, query) {
      const config = getSupabaseServerConfig();
      if (!config?.ok) return { ok: false };
      const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
      if (!response?.ok) return { ok: false };
      const rows = await response.json().catch(() => null);
      return Array.isArray(rows) ? { ok: true, rows } : { ok: false };
    },
    async insert(table, body) {
      const config = getSupabaseServerConfig();
      if (!config?.ok) return { ok: false };
      const response = await fetch(`${config.url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(body)
      }).catch(() => undefined);
      if (!response?.ok) return { ok: false };
      const rows = await response.json().catch(() => []);
      return { ok: true, rows: Array.isArray(rows) ? rows : [] };
    },
    async patch(table, filter, body) {
      const config = getSupabaseServerConfig();
      if (!config?.ok) return { ok: false };
      const response = await fetch(`${config.url}/rest/v1/${table}?${filter}`, {
        method: "PATCH",
        headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(body)
      }).catch(() => undefined);
      if (!response?.ok) return { ok: false };
      const rows = await response.json().catch(() => []);
      return { ok: true, rows: Array.isArray(rows) ? rows : [] };
    },
    async remove(table, filter) {
      const config = getSupabaseServerConfig();
      if (!config?.ok) return { ok: false };
      const response = await fetch(`${config.url}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: supabaseHeaders(config) }).catch(() => undefined);
      return { ok: Boolean(response?.ok) };
    }
  };

  const page = (res, status, { title, heading, body, sections, actions }) =>
    res.status(status).type("html").send(layout({ title, eyebrow: "Your account", heading, body, sections, actions }));

  const securityActions = () => [linkAction("/account/security", "Security"), linkAction("/account", "Account")];

  // ---------------------------------------------------------------------
  // What the person sees about their own factor.
  // ---------------------------------------------------------------------

  app.get("/account/security/two-factor", requireCustomer, async (req, res) => {
    const configured = key();
    if (!configured.ok) {
      return page(res, 503, {
        title: "Two-step sign-in",
        heading: "Two-step sign-in",
        body: "This is not switched on for this deployment yet.",
        // Named rather than hidden. Somebody reading this should be able to
        // tell "we have not finished setting this up" from "your account is
        // not protected", and only the second is about them.
        sections: [brandCard("Not available yet", "Two-step sign-in needs one server setting that has not been made. Nothing is wrong with your account.")],
        actions: securityActions()
      });
    }

    const live = await twoFactor.liveFactor(store, req.sonaraUser.id);
    if (!live.ok) {
      return page(res, 502, {
        title: "Two-step sign-in",
        heading: "Two-step sign-in",
        body: "We could not read your security settings just now.",
        // Three states, not two: this is not "you have no second factor".
        sections: [brandCard("Not available right now", "We could not check whether two-step sign-in is on. Try again shortly — nothing has been changed.")],
        actions: securityActions()
      });
    }

    const on = Boolean(live.factor?.confirmed_at);
    const counted = on ? await twoFactor.countRecoveryCodes(store, req.sonaraUser.id) : { ok: true, left: 0 };
    const problem = String(req.query.problem || "").slice(0, 200);
    const note = problem ? `<p class="fine" role="status">${escapeHtml(problem)}</p>` : "";

    const sections = on
      ? [
          brandCard("Two-step sign-in is on", "After your password, signing in asks for a code from your authenticator app."),
          `<article class="card"><h2>Recovery codes</h2><p>${counted.ok ? `${counted.left} of ${counted.total} unused.` : "We could not count these just now."}</p><p class="fine">Each one works once. They are the way back in if you lose the phone.</p></article>`,
          `<article class="card"><h2>Turn it off</h2>${note}<p>This needs a code, because a signed-in browser is not proof of who is sitting at it.</p><form method="post" action="/account/security/two-factor/disable"><label>Code from your app, or a recovery code<input name="code" inputmode="text" autocomplete="one-time-code" required></label><button class="action" type="submit">Turn off two-step sign-in</button></form></article>`
        ]
      : [
          brandCard("Two-step sign-in is off", "Your password is the only thing protecting this account. Turning this on adds a code from an app on your phone."),
          `<article class="card"><h2>Set it up</h2>${note}<p>You will scan a square with an authenticator app, then type one code to prove it works.</p><form method="post" action="/account/security/two-factor/start"><button class="action" type="submit">Set up two-step sign-in</button></form></article>`
        ];

    return page(res, 200, { title: "Two-step sign-in", heading: "Two-step sign-in", body: "A code from your phone, after your password.", sections, actions: securityActions() });
  });

  // ---------------------------------------------------------------------
  // Enrolment: shown once, confirmed before it counts.
  // ---------------------------------------------------------------------

  app.post("/account/security/two-factor/start", requireCustomer, async (req, res) => {
    const configured = key();
    if (!configured.ok) return res.redirect(303, "/account/security/two-factor");

    const account = req.sonaraUser.email || req.sonaraUser.id;
    const begun = await twoFactor.beginEnrolment(store, configured, { userId: req.sonaraUser.id, account });
    if (!begun.ok) {
      const said = begun.code === "already_enrolled"
        ? "Two-step sign-in is already on for this account."
        : "We could not start this just now. Nothing has been changed.";
      return res.redirect(303, `/account/security/two-factor?problem=${encodeURIComponent(said)}`);
    }

    // Rendered once and never stored anywhere this page can read again: the
    // secret is sealed and the codes are hashed the moment they are written.
    const qr = encodeQr(begun.uri);
    const codes = begun.recoveryCodes.map((code) => `<li><code>${escapeHtml(code)}</code></li>`).join("");

    return page(res, 200, {
      title: "Set up two-step sign-in",
      heading: "Scan this with your authenticator app",
      body: "Then type the six-digit code it shows, to prove the app and this account agree.",
      sections: [
        `<article class="card"><h2>Scan</h2><div class="sonara-qr">${qrToSvg(qr.modules)}</div><p class="fine">No camera? Type this into the app instead: <code>${escapeHtml(begun.readableSecret)}</code></p></article>`,
        `<article class="card"><h2>Save these first</h2><p>Each code works once, and this is the only time they are shown. Without them, losing your phone means losing the account.</p><ul>${codes}</ul></article>`,
        `<article class="card"><h2>Confirm</h2><p>Two-step sign-in is <strong>not on yet</strong>. It starts working when this code is accepted.</p><form method="post" action="/account/security/two-factor/confirm"><label>The six digits your app is showing<input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button class="action" type="submit">Turn on two-step sign-in</button></form></article>`
      ],
      actions: securityActions()
    });
  });

  app.post("/account/security/two-factor/confirm", requireCustomer, async (req, res) => {
    const configured = key();
    if (!configured.ok) return res.redirect(303, "/account/security/two-factor");
    const done = await twoFactor.confirmEnrolment(store, configured, { userId: req.sonaraUser.id, code: req.body?.code });
    if (done.ok) return res.redirect(303, "/account/security/two-factor");
    return res.redirect(303, `/account/security/two-factor?problem=${encodeURIComponent(sayWhy(done.code))}`);
  });

  app.post("/account/security/two-factor/disable", requireCustomer, async (req, res) => {
    const configured = key();
    if (!configured.ok) return res.redirect(303, "/account/security/two-factor");
    const submitted = String(req.body?.code || "").trim();
    // Six digits is a code from the app; anything else is treated as a recovery
    // code. Asking somebody which kind they are holding is a question they
    // should not have to answer.
    const asCode = /^[0-9\s-]{6,8}$/.test(submitted);
    const done = await twoFactor.disableFactor(store, configured, {
      userId: req.sonaraUser.id,
      code: asCode ? submitted : undefined,
      recoveryCode: asCode ? undefined : submitted
    });
    if (done.ok) return res.redirect(303, "/account/security/two-factor");
    return res.redirect(303, `/account/security/two-factor?problem=${encodeURIComponent(sayWhy(done.code))}`);
  });

  // ---------------------------------------------------------------------
  // The challenge, between a correct password and a session.
  // ---------------------------------------------------------------------

  /**
   * Called from `/auth/login` after the password is accepted and **before**
   * the session cookie is set.
   *
   * Returns `true` when it took over and `false` when it did not, so the
   * caller's next line stays the ordinary sign-in.
   *
   * A boolean rather than the response, and that is not a style choice. The
   * first version returned `res.redirect(...)` and `res.status(...).json(...)`
   * directly, and **`res.redirect()` returns undefined**. So the caller saw a
   * falsy value, fell through, and set the session cookie -- while the browser
   * was being redirected to the code prompt. The hold looked like it worked
   * from the outside and did nothing at all: the person landed on the prompt
   * already signed in, and closing it was enough.
   *
   * The JSON path did not have the bug, because `res.json()` does return the
   * response, which is exactly the sort of half-working that survives a demo.
   *
   * A read that fails takes over too, refusing the sign-in. That is the
   * deliberate direction: signing somebody in without their second factor
   * because a table could not be read is the failure this exists to prevent,
   * and "try again shortly" is the cost of getting that right.
   */
  async function holdForSecondFactor(result, req, res) {
    if (!result?.session?.accessToken) return false;
    const configured = key();
    if (!configured.ok) return false;

    const who = await verifySupabaseAccessToken(result.session.accessToken);
    if (!who.ok || !who.user?.id) return false;

    const needed = await twoFactor.challengeRequired(store, who.user.id);
    if (!needed.ok) {
      refuseSignIn(req, res, "We could not check your security settings, so we have not signed you in. Try again shortly.");
      return true;
    }
    if (!needed.required) return false;

    const started = await twoFactor.startChallenge(store, configured, { userId: who.user.id, session: result.session });
    if (!started.ok) {
      refuseSignIn(req, res, "We could not start the second step, so we have not signed you in. Try again shortly.");
      return true;
    }

    res.cookie(CHALLENGE_COOKIE, started.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: String(getEnv(["NODE_ENV"]) || "") === "production",
      path: "/",
      maxAge: started.expiresInSeconds * 1000
    });

    if (acceptsHtml(req)) res.redirect(303, "/login/verify");
    else res.status(200).json({ ok: true, code: "second_factor_required", sessionStored: false, expiresInSeconds: started.expiresInSeconds });
    return true;
  }

  function refuseSignIn(req, res, message) {
    if (!acceptsHtml(req)) return res.status(503).json({ ok: false, code: "second_factor_unavailable", message });
    return page(res, 503, {
      title: "Sign in",
      heading: "Not signed in",
      body: message,
      sections: [brandCard("Nothing has changed", "Your password was accepted. We stopped because we could not complete the second step, and signing you in without it would be worse.")],
      actions: [linkAction("/login", "Try again")]
    });
  }

  app.get("/login/verify", async (req, res) => {
    const token = readChallengeCookie(req);
    if (!token) return res.redirect(303, "/login");
    const problem = String(req.query.problem || "").slice(0, 200);
    return page(res, 200, {
      title: "Two-step sign-in",
      heading: "One more step",
      body: "Your password was accepted. Type the code your authenticator app is showing.",
      sections: [
        `<article class="card">${problem ? `<p class="fine" role="status">${escapeHtml(problem)}</p>` : ""}<form method="post" action="/login/verify"><label>Six-digit code<input name="code" inputmode="numeric" autocomplete="one-time-code" autofocus required></label><button class="action" type="submit">Sign in</button></form></article>`,
        brandCard("Lost your phone?", "Type one of your recovery codes in the same box. Each one works once.")
      ],
      actions: [linkAction("/login", "Start again")]
    });
  });

  app.post("/login/verify", deps.verifyRateLimiter || ((req, res, next) => next()), async (req, res) => {
    const token = readChallengeCookie(req);
    if (!token) return finishFailed(req, res, "That sign-in has expired. Start again.");

    const configured = key();
    if (!configured.ok) return finishFailed(req, res, "Two-step sign-in is not available right now.");

    const submitted = String(req.body?.code || "").trim();
    const asCode = /^[0-9\s-]{6,8}$/.test(submitted);
    const done = await twoFactor.completeChallenge(store, configured, {
      token,
      code: asCode ? submitted : undefined,
      recoveryCode: asCode ? undefined : submitted
    });

    if (!done.ok) {
      // The challenge cookie is cleared only when the challenge itself is
      // finished. A wrong code leaves it, so the person can try again without
      // retyping their password.
      const dead = ["already_used", "expired", "no_challenge", "too_many_attempts"].includes(done.code);
      if (dead) clearChallengeCookie(res);
      return finishFailed(req, res, sayWhy(done.code, done.attemptsLeft), dead);
    }

    clearChallengeCookie(res);
    // The session that was held back, handed over by the same path an ordinary
    // sign-in uses -- so the cookies, their lifetimes and the redirect are one
    // implementation rather than two that can drift.
    return sendEmailAuthResult(req, res, { status: 200, body: { ok: true, code: "login_ready", sessionStored: true }, session: done.session }, "/dashboard", "/login");
  });

  function finishFailed(req, res, message, dead = false) {
    if (!acceptsHtml(req)) return res.status(401).json({ ok: false, code: "second_factor_failed", message });
    if (dead) return res.redirect(303, `/login?problem=${encodeURIComponent(message)}`);
    return res.redirect(303, `/login/verify?problem=${encodeURIComponent(message)}`);
  }

  function readChallengeCookie(req) {
    const raw = String(req.headers?.cookie || "");
    const found = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CHALLENGE_COOKIE}=`));
    return found ? decodeURIComponent(found.slice(CHALLENGE_COOKIE.length + 1)) : "";
  }

  function clearChallengeCookie(res) {
    res.clearCookie(CHALLENGE_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
  }

  return { ok: true, holdForSecondFactor, CHALLENGE_COOKIE };
}

// One sentence per reason, written for the person rather than for a log.
//
// `reused` and `already_used` are deliberately not folded into "that code is
// wrong": a correct code reported as wrong sends somebody to check their
// phone's clock, reinstall the app, and eventually give up on a feature that
// is working.
function sayWhy(code, attemptsLeft) {
  const left = Number.isFinite(attemptsLeft) && attemptsLeft > 0 ? ` ${attemptsLeft} attempts left.` : "";
  switch (code) {
    case "malformed": return "Type the six digits your app is showing.";
    case "no_match": return `That code does not match.${left}`;
    case "reused": return "That code has already been used. Wait for your app to show the next one.";
    case "already_used": return "That recovery code has already been used.";
    case "none_left": return "There are no recovery codes left on this account.";
    case "expired": return "That sign-in took too long. Start again.";
    case "too_many_attempts": return "Too many wrong codes. Start again.";
    case "no_challenge": return "That sign-in has expired. Start again.";
    case "not_enrolled": return "Two-step sign-in is not on for this account.";
    case "already_enrolled": return "Two-step sign-in is already on for this account.";
    case "not_started": return "Start the setup again — that one was not finished.";
    case "cannot_open": return "We could not read the stored settings for this account. Nothing has been changed.";
    case "unreadable":
    case "unwritable": return "We could not save that just now. Nothing has been changed.";
    default: return "That did not work. Nothing has been changed.";
  }
}

module.exports = registerTwoFactorRoutes;
module.exports.REQUIRED = REQUIRED;
module.exports.CHALLENGE_COOKIE = CHALLENGE_COOKIE;
module.exports.sayWhy = sayWhy;
