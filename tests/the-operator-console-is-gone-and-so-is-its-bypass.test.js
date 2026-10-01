"use strict";

// The administration surface was removed on 1 October 2026 at the owner's
// instruction. This file is what stops it coming back by accident, and what
// records the part of the removal that was a security fix rather than a
// deletion.
//
// ## What was removed
//
// 58 registered routes -- 43 pages under /admin and 15 JSON endpoints under
// /api/admin -- plus the login, the session cookie, the rate limiter in front
// of it, and `requireAdmin`. They were SONARA Industries' own screens. No
// customer could reach any of them.
//
// ## The part that was a bypass
//
// `verifyAdminRequest` did not only guard those pages. `resolveWorkspaceAccess`
// called it FIRST, before resolving a customer session, and on success returned
//
//     { ok: true, mode: "owner_admin", ownerOverride: true, productKey, ... }
//
// for whichever organization was being addressed. `requireBusinessManager` did
// the same and additionally set `req.sonaraBusinessMembership = {}`, which is a
// membership record nobody is a member of. A staff session was therefore an
// owner of every business on the platform, and the cookie it read included the
// ordinary customer cookie.
//
// That is not a criticism of the design -- an operator console needs to open a
// customer's workspace to support them. It is a statement of what the door was,
// so that nobody rebuilds it without meaning to. With the console gone the door
// has nothing behind it, and both call sites now resolve a customer session and
// nothing else.
//
// ## What replaced it, for customers
//
// /owner/administration. Organization-scoped, behind requireBusinessManager,
// and tested in tests/a-business-owner-controls-their-own-business.test.js.
// It is not this console under another name: it reads and writes two tables
// that belong to the caller's own organization and cannot address another.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const app = require("../server");

const root = path.join(__dirname, "..");

// A sample across the former surface rather than all 58: one index, one login,
// one page from each family that lived in a different module, and the two JSON
// endpoints that reported platform state. A 404 on these is a 404 on the group.
const REMOVED_PATHS = Object.freeze([
  "/admin",
  "/admin/login",
  "/admin/system",
  "/admin/database",
  "/admin/database-management",
  "/admin/users",
  "/admin/roles",
  "/admin/support",
  "/admin/billing",
  "/admin/agent-activity",
  "/admin/prompt-library",
  "/admin/model-safety-resilience",
  "/admin/system-design-intelligence",
  "/admin/reference-intelligence",
  "/api/admin/overview",
  "/api/admin/env-status",
  "/api/admin/database-readiness",
  "/api/admin/reference-intelligence"
]);

function runtimeSource() {
  const files = [path.join(root, "server.js")];
  for (const directory of ["lib", "routes"]) {
    const base = path.join(root, directory);
    if (!fs.existsSync(base)) continue;
    (function walk(current) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|mjs|js)$/.test(entry.name)) files.push(full);
      }
    })(base);
  }
  // The population is asserted, not assumed. A walk that finds almost nothing
  // would make every doesNotMatch below pass by reading an empty string, which
  // is the first shape in .claude/skills/checks-that-cannot-lie.
  assert.ok(files.length >= 250, `only ${files.length} runtime files read; this check has gone blind`);
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

// Blanks comment and string CONTENTS, keeping length so nothing shifts. Written
// here rather than imported because lib/sonara-comment-stripping.cjs removes
// comments only, and a string literal is the other half of the problem.
function withoutCommentsOrStrings(source) {
  const out = source.split("");
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      let j = source.indexOf("\n", i);
      if (j === -1) j = source.length;
      for (let k = i; k < j; k += 1) out[k] = " ";
      i = j;
    } else if (two === "/*") {
      let j = source.indexOf("*/", i + 2);
      j = j === -1 ? source.length : j + 2;
      for (let k = i; k < j; k += 1) if (source[k] !== "\n") out[k] = " ";
      i = j;
    } else if (source[i] === "\"" || source[i] === "'" || source[i] === "`") {
      const quote = source[i];
      let j = i + 1;
      let escaped = false;
      while (j < source.length) {
        const ch = source[j];
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) break;
        else if (ch === "\n" && quote !== "`") break;
        j += 1;
      }
      for (let k = i + 1; k < Math.min(j, source.length); k += 1) if (source[k] !== "\n") out[k] = "_";
      i = Math.min(j, source.length) + 1;
    } else {
      i += 1;
    }
  }
  return out.join("");
}

describe("the operator console is gone, and so is its bypass", () => {
  it("answers 404 on every former administration path", async () => {
    assert.ok(REMOVED_PATHS.length >= 15, `only ${REMOVED_PATHS.length} paths sampled; the list has been emptied`);
    for (const route of REMOVED_PATHS) {
      const response = await request(app).get(route).set("Accept", "text/html").redirects(0);
      assert.equal(
        response.status,
        404,
        `${route} answered ${response.status}. A removed console that still responds is the console, whatever it renders.`
      );
    }
  });

  it("registers no route under /admin or /api/admin", () => {
    const registered = [];
    for (const layer of app._router.stack) {
      if (!layer.route) continue;
      const route = layer.route.path;
      if (typeof route === "string" && /^\/(api\/)?admin(\/|$)/.test(route)) registered.push(route);
    }
    // The router has to be readable for this to mean anything.
    const total = app._router.stack.filter((layer) => layer.route).length;
    assert.ok(total > 400, `only ${total} routes read from the router; this check has gone blind`);
    assert.deepEqual(registered, [], `these administration routes are still registered: ${registered.join(", ")}`);
  });

  it("keeps the staff bypass out of the two middlewares that had it", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

    // Not a grep for the word. These two assertions name the exact shape the
    // bypass had: a staff check resolved ahead of the customer session, whose
    // success returned ownerOverride for whatever organization was addressed.
    assert.doesNotMatch(
      server,
      /async function resolveWorkspaceAccess[\s\S]{0,400}?verifyAdminRequest/,
      "resolveWorkspaceAccess resolves a staff session again; a staff cookie is an owner of every organization when it does"
    );
    assert.doesNotMatch(
      server,
      /async function requireBusinessManager[\s\S]{0,400}?verifyAdminRequest/,
      "requireBusinessManager resolves a staff session again, which skips the membership check entirely"
    );
    // The membership record nobody is a member of.
    assert.doesNotMatch(
      server,
      /sonaraBusinessMembership = \{\}/,
      "an empty membership object is assigned again, which reads downstream as a membership that was checked"
    );
  });

  it("leaves no administration gate or session behind", () => {
    // Comments AND string contents are stripped first. Both carry these names
    // deliberately: the comments explain the removal, and
    // lib/sonara-route-surface.cjs records in a register `reason` that the
    // subsystem module read its gate as `deps.requireAdmin || (open)`. That
    // sentence is why the bug is findable again, and the first version of this
    // assertion failed on it -- a check firing on its own explanation gets
    // reworded rather than fixed, which is the twelfth shape in
    // .claude/skills/checks-that-cannot-lie. So this reads code.
    const code = withoutCommentsOrStrings(runtimeSource());
    assert.ok(code.length > 200000, `only ${code.length} characters of code left after stripping; this check has gone blind`);
    // And the stripper really strips, checked rather than assumed: without this
    // a masker that blanked everything would make all five assertions pass.
    assert.match(code, /function resolveWorkspaceAccess|async function resolveWorkspaceAccess/);

    for (const symbol of ["requireAdmin", "verifyAdminRequest", "ADMIN_SESSION_COOKIE", "rejectCustomerBearerFromAdminLogin", "adminActions"]) {
      assert.doesNotMatch(
        code,
        new RegExp(`\\b${symbol}\\b`),
        `${symbol} is back in the runtime. The console was removed; its gate and session should not outlive it.`
      );
    }
  });

  it("still has a customer-facing administration surface, so the removal left a way in", async () => {
    // The point of the replacement. Without this the removal reads as "the
    // controls were taken away", and a 404 here would make that true.
    const response = await request(app).get("/owner/administration").set("Accept", "text/html").redirects(0);
    assert.notEqual(response.status, 404, "/owner/administration does not exist, so owners have no controls at all");
    assert.ok(
      [302, 303, 401, 403, 503].includes(response.status),
      `/owner/administration answered ${response.status} to a signed-out request; it must refuse rather than render`
    );
  });
});
