"use strict";

// Which POST endpoints a customer can actually reach from a form.
//
// This module exists because I got the answer wrong six times in a row.
//
// The question "can a customer create one of these?" looks like a grep. It is
// not, because this application wires forms four different ways:
//
//   1. A literal action="/api/thing" in a template.
//   2. A computed action from a page description --
//      `${ui.escape(page.api)}` in routes/sonara-last9-routes.cjs, fed by
//      OWNER_RECORD_PAGES and CREATOR_RECORD_PAGES, which are two separate
//      exported arrays in the same module.
//   3. A computed action from a create spec --
//      `/api/growth/${spec.key}` in routes/growth-studio-control-routes.cjs.
//   4. A per-row action built from a base path and a record id, in
//      lib/sonara-module-crud.cjs.
//
// Every wrong answer I produced came from seeing some of those and not others,
// and every one of them made the product look worse than it is: Business
// Builder's owner pages were reported as having no forms twice, and they have
// thirteen. A whole family of Growth Studio endpoints was reported as missing
// because they are registered under /api/growth and I looked under
// /api/growth-studio.
//
// So the computation lives here, once, and tests/form-reachability.test.js
// checks it against the router rather than against my memory. If a fifth way
// to render a form is added, this module is the thing to teach -- and the
// blindness guards in the test are what should make that necessary rather than
// optional.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function sourceFiles() {
  const files = [path.join(ROOT, "server.js")];
  for (const dir of ["lib", "routes"]) {
    const full = path.join(ROOT, dir);
    for (const entry of fs.readdirSync(full)) {
      if (entry.endsWith(".cjs") || entry.endsWith(".js")) files.push(path.join(full, entry));
    }
  }
  return files;
}

// (1) Literal form actions.
function literalFormActions() {
  const found = new Set();
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/action="(\/[A-Za-z0-9/_:-]+)"/g)) found.add(match[1]);
  }
  return found;
}

// (2) Record pages that render a form at their own `api`. Every exported array
// is read, not just the first -- reading only the first is the bug that hid
// CREATOR_RECORD_PAGES and reported /api/creator/music-projects as unreachable.
function recordPageFormActions() {
  const found = new Set();
  const pages = require("./sonara-owner-record-pages.cjs");
  for (const value of Object.values(pages)) {
    if (!Array.isArray(value)) continue;
    for (const page of value) {
      if (page && typeof page.api === "string" && page.api.startsWith("/")) found.add(page.api);
    }
  }
  return found;
}

// (3) Growth Studio create forms.
function growthSpecFormActions() {
  const found = new Set();
  const { GROWTH_CREATE_SPECS } = require("./sonara-growth-create-specs.cjs");
  for (const spec of GROWTH_CREATE_SPECS) found.add(`/api/growth/${spec.key}`);
  return found;
}

function reachableFormActions() {
  return new Set([...literalFormActions(), ...recordPageFormActions(), ...growthSpecFormActions()]);
}

// A POST route that looks like "create one of these" rather than an action on
// one that already exists, a webhook, or a session operation.
const NOT_A_CREATE = /(archive|restore|refresh|cancel|publish|webhook|session|login|logout|review|import|evaluate|render)/;
const HAS_PARAM = /:[A-Za-z]+/;

function createShapedRoutes(app) {
  const routes = [];
  const walk = (stack) => {
    for (const layer of stack) {
      if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  };
  walk(app._router ? app._router.stack : app.router.stack);
  return [...new Set(routes.filter((route) => route.methods.includes("post")).map((route) => route.path))]
    .filter((route) => route.startsWith("/api/"))
    .filter((route) => !HAS_PARAM.test(route))
    .filter((route) => !NOT_A_CREATE.test(route))
    .sort();
}

module.exports = {
  literalFormActions,
  recordPageFormActions,
  growthSpecFormActions,
  reachableFormActions,
  createShapedRoutes
};
