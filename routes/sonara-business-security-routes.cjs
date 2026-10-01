// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The business owner's own passcode, and the gate it opens.
//
// lib/sonara-business-passcode.cjs holds the construction and the reasoning.
// This file holds the three things that need a request: reading and writing
// the credential row, putting the unlock in a cookie, and the middleware other
// route modules hang off.
//
// ## What the gate does when there is no passcode
//
// It lets the request through, and the page it was going to says so in as many
// words. That is a deliberate choice and the alternative was worse: refusing
// would lock an owner out of their own payroll on the strength of a feature
// they have not been told about yet.
//
// What it must never do is let the request through *quietly*. A gate that
// passes everything while the page implies protection is the exact defect
// CLAUDE.md is about -- a signal reporting success without being true. So the
// gate reports its state on the request, the pages render it, and
// tests/a-management-passcode-is-a-second-thing-to-know.test.js asserts the
// unprotected banner is present when no credential exists. If somebody later
// makes the gate silent, that test fails.
//
// ## Three states, not two
//
// `not_set`, `unlocked`, `locked`. Plus two refusals that are neither: the
// credential row could not be read, and the key that verifies it is not
// configured. Both deny. Neither is reported as "no passcode set", because
// reading a failed database call as "this business has no passcode" is a way
// to walk through the gate by breaking something.

const {
  MINIMUM_LENGTH,
  MAXIMUM_FAILURES,
  UNLOCK_SECONDS,
  UNLOCK_COOKIE,
  checkPasscodeAgainstBreaches,
  hashPasscode,
  verifyPasscode,
  failureState,
  lockState,
  issueUnlock,
  verifyUnlock
} = require("../lib/sonara-business-passcode.cjs");
const { keyFrom } = require("../lib/sonara-secret-box.cjs");

const SECURITY_PATH = "/business-builder/owner/security";
const CREDENTIAL_TABLE = "business_management_credentials";

// What the gate is put in front of. Each is a surface where the answer to
// "should a borrowed browser be enough?" is no.
const PROTECTED_SURFACES = Object.freeze([
  ["/business-builder/owner/pay-periods", "Pay periods and draft statements"],
  ["/owner/administration", "Sub-applications and what is running"]
]);

module.exports = function registerBusinessSecurityRoutes(app, deps = {}) {
  const ui = {
    layout: deps.layout || basicLayout,
    card: deps.brandCard || card,
    link: deps.linkAction || link,
    escape: deps.escapeHtml || escapeHtml
  };
  const requireBusinessManager = typeof deps.requireBusinessManager === "function"
    ? deps.requireBusinessManager
    : failClosed;
  const getConfig = typeof deps.getSupabaseServerConfig === "function" ? deps.getSupabaseServerConfig : () => ({ ok: false });
  const getEnv = typeof deps.getEnv === "function" ? deps.getEnv : undefined;
  const readCookie = typeof deps.getCookie === "function" ? deps.getCookie : getCookie;
  const isProduction = typeof deps.isProductionEnvironment === "function"
    ? deps.isProductionEnvironment
    : () => String(process.env.NODE_ENV || "") === "production";
  // Rate limiting is not optional on this module, and the fallback is a refusal
  // rather than a passthrough.
  //
  // It was `: (req, res, next) => next()`, which is the fail-open shape
  // CLAUDE.md is about: a deployment that forgot to pass `createRateLimiter`
  // would serve an unthrottled passcode-guessing endpoint while every line of
  // this file still read as rate-limited. The lockout after five wrong answers
  // is a per-credential counter, not a per-caller one, so it is not a
  // substitute: it bounds guesses against one business, and a limiter bounds
  // requests from one caller across all of them.
  const limiter = typeof deps.createRateLimiter === "function"
    ? deps.createRateLimiter({
        name: "business.management_unlock",
        windowSeconds: 300,
        maxAttempts: 10,
        scopes: ["ip", "subject"],
        subjectFrom: (req) => req.sonaraUser?.id || req.sonaraAccess?.user?.id,
        getSupabaseServerConfig: deps.getSupabaseServerConfig
      })
    : (req, res) => {
        if (wantsHtml(req)) return res.redirect(303, `${SECURITY_PATH}?problem=rate_limiter_unavailable`);
        return res.status(503).json({ ok: false, code: "rate_limiter_unavailable", service: "business_security" });
      };

  async function scope(req) {
    const config = getConfig();
    if (!config.ok) return { ok: false, code: "setup_required", message: "Your account database is not connected yet." };
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    if (typeof deps.getCustomerPrimaryOrganization !== "function") {
      return { ok: false, code: "no_organization", message: "We could not tell which business you are signed in to." };
    }
    const organization = await deps.getCustomerPrimaryOrganization(user);
    if (!organization?.ok) {
      return { ok: false, code: "no_organization", message: "We could not tell which business you are signed in to. Sign in again and this will fill up." };
    }
    return { ok: true, config, organizationId: organization.organizationId, userId: String(user?.id || "") };
  }

  // The credential row for a business, or a reason there is not one.
  //
  // `{ ok: true, credential }` where credential may be null -- that is the
  // "none set" answer and it is a success. `{ ok: false, code }` is a failure
  // to find out, which is a different thing and is never collapsed into the
  // first.
  async function readCredential(config, organizationId) {
    const read = await rest(config, CREDENTIAL_TABLE, `select=id,passcode_hash,failed_attempts,locked_until,last_verified_at,updated_at&organization_id=eq.${enc(organizationId)}&limit=1`);
    if (!read.ok) return { ok: false, code: "credential_unreadable" };
    return { ok: true, credential: read.rows[0] || null };
  }

  // Where this request stands against its business's passcode.
  //
  // The one function the gate and the page both use, so they cannot disagree
  // about whether somebody is unlocked.
  async function unlockStatus(req, where) {
    const key = keyFrom(getEnv);
    const found = await readCredential(where.config, where.organizationId);
    if (!found.ok) return { state: "unreadable", code: found.code };
    if (!found.credential) return { state: "not_set" };

    // A credential exists and the key that verifies it does not. This business
    // asked for a passcode; answering "no passcode set" because a deployment
    // variable went missing would open exactly what the owner closed.
    if (!key.ok) return { state: "unverifiable", code: key.code, variable: key.variable };

    const now = Date.now();
    const locked = lockState(found.credential.locked_until, now);
    if (locked.locked) {
      return { state: "locked", code: locked.code, secondsRemaining: locked.secondsRemaining, credential: found.credential };
    }

    const token = readCookie(req, UNLOCK_COOKIE);
    const verified = verifyUnlock(token, {
      organizationId: where.organizationId,
      userId: where.userId,
      credentialVersion: found.credential.updated_at,
      nowMs: now,
      key
    });
    if (verified.ok) return { state: "unlocked", expiresAtMs: verified.expiresAtMs, credential: found.credential };
    return { state: "needs_unlock", code: verified.code, credential: found.credential };
  }

  function setUnlockCookie(res, token) {
    res.cookie(UNLOCK_COOKIE, token, {
      httpOnly: true,
      // Strict rather than lax. A management unlock has no business riding
      // along on a navigation that started on somebody else's site, and unlike
      // the sign-in cookie there is no flow here that depends on it doing so.
      sameSite: "strict",
      secure: isProduction(),
      path: "/",
      maxAge: UNLOCK_SECONDS * 1000
    });
  }

  function clearUnlockCookie(res) {
    res.clearCookie(UNLOCK_COOKIE, { httpOnly: true, sameSite: "strict", secure: isProduction(), path: "/" });
  }

  // ---------------------------------------------------------------------------
  // The gate other route modules use
  // ---------------------------------------------------------------------------

  async function requireManagementUnlock(req, res, next) {
    const where = await scope(req);
    if (!where.ok) {
      // Two different failures, and they do not get the same answer.
      //
      // `setup_required` means this deployment has no database configured at
      // all. There is then no credential to check, and also nothing behind the
      // page to protect -- every read it would make fails too. Refusing here
      // replaced each protected page's own honest "your database is not
      // connected yet" with a redirect to a security page that cannot explain
      // itself either, which is less useful and no safer. So it passes, and
      // says which state it passed in.
      //
      // Anything else -- chiefly "we could not tell which business you are
      // signed in to" -- refuses. Without an organization there is no
      // credential to look up, so there is no basis on which to let it past.
      if (where.code === "setup_required") {
        req.sonaraManagementUnlock = { state: "no_database", code: where.code };
        return next();
      }
      if (wantsHtml(req)) return res.redirect(303, `${SECURITY_PATH}?problem=${enc(where.code)}`);
      return res.status(503).json({ ok: false, code: where.code });
    }
    const status = await unlockStatus(req, where);
    req.sonaraManagementUnlock = status;
    if (status.state === "not_set" || status.state === "unlocked") return next();

    if (!wantsHtml(req)) {
      return res.status(status.state === "unreadable" ? 503 : 403).json({ ok: false, code: status.code || status.state });
    }
    const back = String(req.originalUrl || req.url || "");
    return res.redirect(303, `${SECURITY_PATH}?problem=${enc(status.code || status.state)}&next=${enc(back)}`);
  }

  // ---------------------------------------------------------------------------
  // The page
  // ---------------------------------------------------------------------------

  app.get(SECURITY_PATH, requireBusinessManager, async (req, res) => {
    const where = await scope(req);
    if (!where.ok) {
      return res.status(200).type("html").send(render(ui, [ui.card("Not available right now", where.message)]));
    }
    const status = await unlockStatus(req, where);
    const sections = [];

    const problem = problemFrom(req);
    if (problem) sections.push(ui.card("That did not go through", problem));
    if (req.query?.saved) sections.push(ui.card("Saved", "Your management passcode has been changed. Every device that was unlocked has been locked again."));
    if (req.query?.locked) sections.push(ui.card("Locked", "These pages are closed again on this device."));

    sections.push(statusCard(ui, status));
    sections.push(protectedList(ui));
    sections.push(passcodeForm(ui, status));
    if (status.state === "needs_unlock") sections.push(unlockForm(ui, String(req.query?.next || "")));
    if (status.state === "unlocked") sections.push(lockForm());

    return res.status(200).type("html").send(render(ui, sections));
  });

  // ---------------------------------------------------------------------------
  // Setting or changing the passcode
  // ---------------------------------------------------------------------------

  app.post(`${SECURITY_PATH}/passcode`, requireBusinessManager, limiter, async (req, res) => {
    const answer = answerer(req, res);
    const where = await scope(req);
    if (!where.ok) return answer(503, { ok: false, code: where.code });

    const key = keyFrom(getEnv);
    if (!key.ok) {
      // Refuse rather than store something weaker. A passcode written without
      // the pepper would verify, and would be worth far less than the owner
      // was told it is worth.
      return answer(503, { ok: false, code: "passcode_key_missing" });
    }

    const found = await readCredential(where.config, where.organizationId);
    if (!found.ok) return answer(503, { ok: false, code: found.code });

    // Changing an existing passcode needs the existing one. Without this, a
    // borrowed browser does not need to guess the passcode -- it replaces it.
    if (found.credential) {
      const locked = lockState(found.credential.locked_until, Date.now());
      if (locked.locked) return answer(429, { ok: false, code: locked.code });
      const current = verifyPasscode(req.body?.currentPasscode, found.credential.passcode_hash, key);
      if (!current.ok) return answer(503, { ok: false, code: current.code });
      if (!current.matches) {
        const next = failureState(found.credential.failed_attempts, Date.now());
        await rest(where.config, CREDENTIAL_TABLE, `organization_id=eq.${enc(where.organizationId)}`, {
          method: "PATCH",
          body: { failed_attempts: next.failures, locked_until: next.lockedUntilMs ? new Date(next.lockedUntilMs).toISOString() : null }
        });
        return answer(403, { ok: false, code: "current_passcode_wrong" });
      }
    }

    const candidate = String(req.body?.passcode ?? "");
    if (candidate !== String(req.body?.confirmPasscode ?? "")) {
      return answer(400, { ok: false, code: "passcode_mismatch" });
    }
    const acceptable = await checkPasscodeAgainstBreaches(candidate);
    if (!acceptable.ok) return answer(400, { ok: false, code: acceptable.code, message: acceptable.message });

    const row = {
      organization_id: where.organizationId,
      passcode_hash: hashPasscode(candidate, key),
      failed_attempts: 0,
      locked_until: null,
      set_by: where.userId || null,
      updated_at: new Date().toISOString()
    };
    // on_conflict on organization_id, which the table declares unique. One
    // statement, so there is no window in which a business has two credentials
    // or none.
    const saved = await rest(where.config, CREDENTIAL_TABLE, "on_conflict=organization_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [row]
    });
    if (!saved.ok) return answer(502, { ok: false, code: "not_saved" });

    // The old unlock is already dead -- it was signed over the previous
    // updated_at. Clearing the cookie just stops this browser carrying a value
    // that can no longer mean anything.
    clearUnlockCookie(res);
    return answer(200, { ok: true });
  });

  // ---------------------------------------------------------------------------
  // Unlocking
  // ---------------------------------------------------------------------------

  app.post(`${SECURITY_PATH}/unlock`, requireBusinessManager, limiter, async (req, res) => {
    const where = await scope(req);
    const destination = safeNext(req.body?.next);
    const answer = answerer(req, res, destination);
    if (!where.ok) return answer(503, { ok: false, code: where.code });

    const key = keyFrom(getEnv);
    if (!key.ok) return answer(503, { ok: false, code: "passcode_key_missing" });

    const found = await readCredential(where.config, where.organizationId);
    if (!found.ok) return answer(503, { ok: false, code: found.code });
    if (!found.credential) return answer(400, { ok: false, code: "no_passcode_set" });

    const now = Date.now();
    const locked = lockState(found.credential.locked_until, now);
    if (locked.locked) return answer(429, { ok: false, code: locked.code, secondsRemaining: locked.secondsRemaining });

    const result = verifyPasscode(req.body?.passcode, found.credential.passcode_hash, key);
    // A row that cannot be parsed is not a wrong answer. Counting it as one
    // would burn an owner's five attempts against a problem no passcode fixes,
    // and then lock them out of their own payroll for a quarter of an hour.
    if (!result.ok) return answer(503, { ok: false, code: result.code });

    if (!result.matches) {
      const next = failureState(found.credential.failed_attempts, now);
      await rest(where.config, CREDENTIAL_TABLE, `organization_id=eq.${enc(where.organizationId)}`, {
        method: "PATCH",
        body: { failed_attempts: next.failures, locked_until: next.lockedUntilMs ? new Date(next.lockedUntilMs).toISOString() : null }
      });
      return answer(403, { ok: false, code: next.lockedUntilMs ? "locked_out" : "passcode_wrong", remaining: next.remaining });
    }

    const minted = issueUnlock({
      organizationId: where.organizationId,
      userId: where.userId,
      credentialVersion: found.credential.updated_at,
      nowMs: now,
      key
    });
    setUnlockCookie(res, minted.token);
    await rest(where.config, CREDENTIAL_TABLE, `organization_id=eq.${enc(where.organizationId)}`, {
      method: "PATCH",
      body: { failed_attempts: 0, locked_until: null, last_verified_at: new Date(now).toISOString() }
    });
    return answer(200, { ok: true, expiresAtMs: minted.expiresAtMs });
  });

  // ---------------------------------------------------------------------------
  // Locking again, deliberately
  // ---------------------------------------------------------------------------

  app.post(`${SECURITY_PATH}/lock`, requireBusinessManager, limiter, async (req, res) => {
    clearUnlockCookie(res);
    if (!wantsHtml(req)) return res.status(200).json({ ok: true });
    return res.redirect(303, `${SECURITY_PATH}?locked=1`);
  });

  return { requireManagementUnlock, unlockStatus, scope };
};

// -----------------------------------------------------------------------------
// Rendering
//
// Each form's action is written out in full rather than interpolated from
// SECURITY_PATH. scripts/generate-capability-inventory.cjs reads form actions
// out of the rendered markup and rewrites any `${...}` it finds as
// `:parameter`, so an interpolated action would be recorded as a route that
// does not exist.
//
// Stated as measured on 1 October 2026 rather than as the fix it looks like:
// spelling the actions out was necessary and was **not sufficient**. These
// three forms are still absent from `uiFormActionLinks` in
// data/capability-inventory.json. The generator's call-graph walk does find
// `passcodeForm`, `unlockForm` and `lockForm` and each body does contain its
// `<form method="post" action="...">`, so something between the page handler
// and those helpers stops it -- and that is unfinished, not solved. The forms
// themselves work and are covered by
// tests/a-management-passcode-is-a-second-thing-to-know.test.js.
// -----------------------------------------------------------------------------

function render(ui, sections) {
  const body = "A passcode of your own for the parts of your business a borrowed browser should not reach.";
  // `eyebrow` is not optional. The shared layout interpolates it, so leaving it
  // out renders the literal string "undefined" above the heading, in the middle
  // of a sentence the customer reads --
  // tests/no-page-lies-when-the-database-is-down.test.js caught exactly that
  // here. The title carries no " | SONARA" suffix either, because the layout
  // adds the product name itself and every other owner page passes the bare one.
  return ui.layout({
    title: "Business security",
    eyebrow: "Your business",
    heading: "Business security",
    body,
    sections: sections.length ? sections : [ui.card("Not available right now", body)],
    actions: [
      ui.link("/business-builder/owner", "Owner dashboard"),
      ui.link("/owner/administration", "Business controls"),
      ui.link("/business-builder/dashboard", "Business Builder")
    ]
  });
}

function statusCard(ui, status) {
  if (status.state === "unreadable") {
    return ui.card(
      "We could not check your passcode",
      "The database did not answer just now. Nothing has changed. Until it does, the pages that need a passcode stay closed — which is the safe way round, not a fault with your passcode."
    );
  }
  if (status.state === "unverifiable") {
    return ui.card(
      "Your passcode cannot be checked on this deployment",
      `This business has a management passcode, but the server key that verifies it is not configured (${status.variable}). The protected pages stay closed until it is. Your passcode is unchanged and still correct.`
    );
  }
  if (status.state === "not_set") {
    return ui.card(
      "No management passcode set",
      `Right now the pages below are protected by your sign-in alone. A sign-in can last up to thirty days on a browser, so anyone using that browser has them. Setting a passcode of at least ${MINIMUM_LENGTH} characters adds something that has to be known rather than merely held.`
    );
  }
  if (status.state === "locked") {
    const minutes = Math.ceil((status.secondsRemaining || 0) / 60);
    return ui.card(
      "Too many wrong answers",
      `Unlocking is closed for about ${minutes} more minute${minutes === 1 ? "" : "s"}. ${MAXIMUM_FAILURES} wrong answers closes it; this protects your records from someone trying one passcode after another.`
    );
  }
  if (status.state === "unlocked") {
    const minutes = Math.max(1, Math.round(((status.expiresAtMs || 0) - Date.now()) / 60000));
    return ui.card(
      "Unlocked on this device",
      `The protected pages are open here for about ${minutes} more minute${minutes === 1 ? "" : "s"}, then they close on their own. You can close them now with the button below.`
    );
  }
  return ui.card(
    "Locked",
    "Enter your management passcode to open the pages below on this device. It opens them for thirty minutes and then closes again by itself."
  );
}

function protectedList(ui) {
  const rows = PROTECTED_SURFACES.map(([href, label2]) =>
    `<li><a href="${ui.escape(href)}">${ui.escape(label2)}</a></li>`).join("");
  return `<article class="card"><h2>What the passcode covers</h2><ul>${rows}</ul><p class="fine">Your sign-in is still required as well. The passcode is in addition to it, never instead of it.</p></article>`;
}

function passcodeForm(ui, status) {
  const existing = status.state !== "not_set" && status.state !== "unreadable";
  const current = existing
    ? `<label for="currentPasscode">Your current passcode</label><input id="currentPasscode" name="currentPasscode" type="password" autocomplete="current-password" required>`
    : "";
  return `<article class="card">
      <h2>${existing ? "Change your management passcode" : "Set a management passcode"}</h2>
      <p>At least ${MINIMUM_LENGTH} characters. It is stored as a one-way hash, so nobody — including SONARA — can read it back. If you forget it there is no recovery, only replacement, and replacing it needs the one you have now.</p>
      <form method="post" action="/business-builder/owner/security/passcode">
        ${current}
        <label for="passcode">New passcode</label>
        <input id="passcode" name="passcode" type="password" autocomplete="new-password" minlength="${MINIMUM_LENGTH}" required>
        <label for="confirmPasscode">Type it again</label>
        <input id="confirmPasscode" name="confirmPasscode" type="password" autocomplete="new-password" minlength="${MINIMUM_LENGTH}" required>
        <button type="submit">${existing ? "Change passcode" : "Set passcode"}</button>
      </form>
    </article>`;
}

function unlockForm(ui, next) {
  return `<article class="card">
      <h2>Unlock this device</h2>
      <form method="post" action="/business-builder/owner/security/unlock">
        <input type="hidden" name="next" value="${ui.escape(next)}">
        <label for="unlockPasscode">Management passcode</label>
        <input id="unlockPasscode" name="passcode" type="password" autocomplete="current-password" required>
        <button type="submit">Unlock for 30 minutes</button>
      </form>
    </article>`;
}

// No `ui` parameter: this form interpolates nothing, so there is nothing to
// escape, and an unused escaper is a hook for somebody to interpolate without
// one later.
function lockForm() {
  return `<article class="card">
      <h2>Finished for now</h2>
      <form method="post" action="/business-builder/owner/security/lock"><button type="submit">Lock these pages again</button></form>
    </article>`;
}

function problemFrom(req) {
  const code = String(req.query?.problem || "").trim();
  if (!code) return "";
  const messages = {
    passcode_mismatch: "The two new passcodes did not match, so nothing was changed.",
    current_passcode_wrong: "That is not your current passcode, so nothing was changed.",
    passcode_wrong: "That passcode is not right. Check it and try again.",
    locked_out: `Too many wrong answers. Unlocking is closed for ${Math.round(15)} minutes.`,
    unreadable_lock: "Unlocking is closed for now.",
    no_passcode_set: "There is no management passcode on this business yet. Set one below.",
    passcode_key_missing: "This deployment cannot store or check a passcode yet. Nothing has changed.",
    rate_limiter_unavailable: "This deployment cannot throttle passcode attempts yet, so the passcode pages are closed. Nothing has changed.",
    credential_unreadable: "We could not reach your security settings just now. Nothing has changed.",
    unlock_expired: "Your unlock ran out. Enter your passcode to carry on.",
    unlock_invalid: "This device is not unlocked. Enter your passcode to carry on.",
    no_unlock: "Enter your management passcode to open that page.",
    too_short: `Use at least ${MINIMUM_LENGTH} characters.`,
    leaked: "That passcode has appeared in a public data breach. Choose a different one.",
    counting: "Counting up or down is guessed first. Use a phrase you will remember.",
    one_character: "One repeated character is guessed first. Use a phrase you will remember.",
    padded: "A passcode cannot start or end with a space.",
    setup_required: "Your account database is not connected yet.",
    no_organization: "We could not tell which business you are signed in to."
  };
  return messages[code] || "Nothing was changed. Try again shortly.";
}

// -----------------------------------------------------------------------------
// Plumbing
// -----------------------------------------------------------------------------

// Where a form post goes back to.
//
// Only a path on this site, and only one that starts with a single slash.
// `//evil.example` is a protocol-relative URL that a browser follows off-site,
// and a redirect target taken from a form body is exactly where that gets
// used.
function safeNext(value) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "";
  if (!/^\/[A-Za-z0-9/_\-?=&.%]*$/.test(candidate)) return "";
  return candidate;
}

function answerer(req, res, destination = "") {
  return (status, payload) => {
    if (!wantsHtml(req)) return res.status(status).json(payload);
    if (payload.ok) return res.redirect(303, destination || `${SECURITY_PATH}?saved=1`);
    return res.redirect(303, `${SECURITY_PATH}?problem=${enc(payload.code || "not_saved")}`);
  };
}

function wantsHtml(req) {
  return String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
}

async function rest(config, table, query = "", options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, rows: Array.isArray(rows) ? rows : [] };
}

// Fails closed, like routes/sonara-owner-administration-routes.cjs. A missing
// gate on this module would publish the form that sets the passcode.
function failClosed(req, res) {
  if (String(req.get?.("accept") || "").includes("text/html")) return res.redirect(303, "/login");
  return res.status(503).json({ ok: false, code: "setup_required", service: "business_security" });
}

function getCookie(req, name) {
  const header = String(req.get?.("cookie") || "");
  for (const part of header.split(";")) {
    const pair = part.trim();
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    try {
      if (decodeURIComponent(pair.slice(0, separator)) === name) return decodeURIComponent(pair.slice(separator + 1));
    } catch {
      continue;
    }
  }
  return "";
}

function enc(value) { return encodeURIComponent(String(value || "")); }
function basicLayout(data) { return `<!doctype html><html><head><title>${escapeHtml(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`; }
function link(href, label2) { return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label2)}</a>`; }
function escapeHtml(value) { return String(value === 0 ? 0 : value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }

module.exports.SECURITY_PATH = SECURITY_PATH;
module.exports.CREDENTIAL_TABLE = CREDENTIAL_TABLE;
module.exports.PROTECTED_SURFACES = PROTECTED_SURFACES;
module.exports.safeNext = safeNext;
