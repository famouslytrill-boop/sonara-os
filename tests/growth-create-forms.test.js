"use strict";

// Ten Growth Studio create endpoints existed and no page rendered a form for
// any of them.
//
// POST /api/growth/segments, /experiments, /consents, /automations, /content,
// /conversions and /touchpoints all validated their input, scoped to the
// organization and wrote audit events. A customer's only way to reach one was
// to hand-craft an HTTP request. The record page listed the records, correctly
// showed none, and offered no way to add one.
//
// This file exists because of a mistake, and the checks are shaped by it.
// docs/WORKSPACE_WORKFLOW_AUDIT.md first reported these record types as having
// no create endpoint at all, because I looked for /api/growth-studio/<type>
// when the routes are at /api/growth/<type>. Acting on that would have
// registered a second handler on every one of those paths.
//
// So the first check here is the one that catches that class of error: every
// form must post to a path the router actually has, and no path may have two
// handlers. The rest check the thing the wrong conclusion hid -- that a form
// naming a field its handler ignores is worse than no form, because the box
// looks like it does something.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");
const { GROWTH_CREATE_SPECS, getGrowthCreateSpec } = require("../lib/sonara-growth-create-specs.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");

const routeSource = fs.readFileSync(path.join(__dirname, "..", "routes", "growth-studio-control-routes.cjs"), "utf8");

function registeredRoutes() {
  const found = [];
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) found.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router ? app._router.stack : app.router.stack);
  return found;
}

// The body fields a handler reads, taken from the handler itself.
function handlerFields(key) {
  const start = routeSource.indexOf(`app.post("/api/growth/${key}"`);
  if (start === -1) return null;
  const end = routeSource.indexOf('\n  app.', start + 10);
  const body = routeSource.slice(start, end === -1 ? routeSource.length : end);
  return new Set([...body.matchAll(/req\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((match) => match[1]));
}

describe("Growth Studio create forms", () => {
  const routes = registeredRoutes();
  const posts = routes.filter((route) => route.methods.includes("post")).map((route) => route.path);

  it("describes at least one form, so the rest of this file is checking something", () => {
    assert.ok(GROWTH_CREATE_SPECS.length >= 3, `only ${GROWTH_CREATE_SPECS.length} specs; this check has gone blind`);
  });

  it("posts only to endpoints that exist", () => {
    // The check that would have caught the wrong audit. A form pointing at a
    // path with no handler is a button that 404s.
    const missing = GROWTH_CREATE_SPECS.filter((spec) => !posts.includes(`/api/growth/${spec.key}`)).map((spec) => spec.key);
    assert.deepEqual(missing, [], `these forms post to endpoints that do not exist: ${missing.join(", ")}`);
  });

  it("does not register a second handler on any of those paths", () => {
    // Acting on the wrong conclusion would have added a duplicate POST for
    // segments, experiments and consents. Express keeps the first and the
    // second becomes unreachable, which no test would otherwise notice.
    const growthPosts = posts.filter((route) => route.startsWith("/api/growth/"));
    const duplicates = growthPosts.filter((route, index) => growthPosts.indexOf(route) !== index);
    assert.deepEqual([...new Set(duplicates)], [], `these paths have more than one POST handler: ${[...new Set(duplicates)].join(", ")}`);
  });

  it("only offers fields the handler actually reads", () => {
    // A field the handler ignores renders as a box that silently does nothing.
    // Experiments had exactly this: the first draft offered a status select and
    // the handler never reads req.body.status.
    const ignored = [];
    for (const spec of GROWTH_CREATE_SPECS) {
      const fields = handlerFields(spec.key);
      assert.ok(fields, `no handler found for /api/growth/${spec.key}`);
      for (const [column] of spec.fields) {
        const camel = column.replace(/_([a-z])/g, (_, chr) => chr.toUpperCase());
        if (!fields.has(column) && !fields.has(camel)) ignored.push(`${spec.key}.${column}`);
      }
    }
    assert.deepEqual(ignored, [], `these form fields are ignored by their handler: ${ignored.join(", ")}`);
  });

  it("lands each form on a record page a customer already reaches", () => {
    // A create route reachable only by knowing its URL is the same as not
    // having one, which is the whole finding.
    for (const spec of GROWTH_CREATE_SPECS) {
      const page = GROWTH_RECORD_PAGES.find((record) => record.tableKey === spec.tableKey);
      assert.ok(page, `${spec.key} has no record page to put its form on`);
      assert.equal(getGrowthCreateSpec(page.tableKey).key, spec.key);
    }
  });

  it("renders the form onto the record page rather than only defining it", () => {
    // The failure this codebase keeps producing: something defined, shipped,
    // and wired to nothing.
    assert.match(routeSource, /createFormCard\(createSpec, ui\.escape\)/, "the record page never renders the form");
    assert.match(routeSource, /getGrowthCreateSpec\(page\.tableKey\)/, "the page never looks up a form for itself");
  });

  it("marks the required fields as required in the markup", () => {
    const { GROWTH_CREATE_SPECS: specs } = require("../lib/sonara-growth-create-specs.cjs");
    const consent = specs.find((spec) => spec.key === "consents");
    const source = consent.fields.find(([column]) => column === "source");
    assert.ok(source, "the consent form no longer asks where the permission came from");
    assert.equal(source[2].required, true, "a consent record may not be saved without a stated origin");
  });

  it("keeps no dead configuration in the specs", () => {
    // The specs describe a form. They stopped validating and inserting when the
    // duplicate handlers were removed, and config that nothing reads is how a
    // file starts lying about what it does.
    const specSource = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-growth-create-specs.cjs"), "utf8");
    for (const dead of ["always:", "refusal:", "path:", "title:"]) {
      assert.ok(!specSource.includes(dead), `${dead} is in the specs and nothing reads it`);
    }
  });
});
