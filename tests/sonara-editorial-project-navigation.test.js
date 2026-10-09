"use strict";
const assert = require("node:assert/strict");
const registerCreatorProjectRoutes = require("../routes/sonara-creator-project-routes.cjs");
const BASE = "/creator-studio/projects";
const EDITOR = "/creator-studio/editorial";

async function renderProjects(editorialEnabled) {
  const endpoints = new Map();
  const app = {
    get(path, ...handlers) { endpoints.set("GET " + path, handlers); },
    post(path, ...handlers) { endpoints.set("POST " + path, handlers); }
  };
  const pages = [];
  const deps = {
    layout(info) {
      pages.push(info);
      return "<html>ok</html>";
    },
    brandCard(_title, body) { return body; },
    linkAction(path, label) { return { path, label }; },
    escapeHtml(value) { return String(value); },
    wantsJson() { return false; },
    requirePaidOrOwnerAccess() { return (_req, _res, next) => next(); },
    projectStore: {
      async list() { return { ok: true, projects: [], truncated: false }; }
    },
    editorialWorkbenchEnabled() { return editorialEnabled; }
  };
  registerCreatorProjectRoutes(app, deps);
  const handler = endpoints.get("GET " + BASE)?.at(-1);
  assert.equal(typeof handler, "function");
  let output = null;
  await handler({}, {
    status() { return this; },
    type() { return this; },
    send(body) { output = body; return this; }
  });
  assert.equal(output, "<html>ok</html>");
  return pages.at(-1);
}

describe("Creator Project to Editorial Workbench navigation gate", () => {
  it("does not advertise a disabled editorial destination", async () => {
    const page = await renderProjects(false);
    assert.ok(page);
    assert.equal(page.actions.some(a => a.path === EDITOR), false);
  });
  it("advertises the real editorial destination only after operator enablement", async () => {
    const page = await renderProjects(true);
    const actions = page.actions.filter(a => a.path === EDITOR);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].label, "Write, storyboard and plan");
  });
  it("keeps existing project and asset actions when editorial is enabled", async () => {
    const page = await renderProjects(true);
    for (const pathname of [BASE, "/creator-studio/assets", "/creator-studio/dashboard"]) {
      assert.ok(page.actions.some(a => a.path === pathname));
    }
  });
});
