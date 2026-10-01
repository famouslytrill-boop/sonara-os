"use strict";

// "There should be no quotes, no intake forms. Of any kind." -- the owner,
// 1 October 2026. This file is the intake half.
//
// What was there: a public-ish form on a Business Builder workspace page posting
// to `/api/business-builder/intake`, a handler that recorded the submission and
// emailed a confirmation, a helper that turned the submission into a customer
// record, and a page at `/business-builder/intake` that had already been reduced
// to a hidden redirect.
//
// What is left: the table. Rows a business already collected are that business's
// records and are not deleted -- dropping them is a destructive data change and
// AGENTS.md puts those behind owner approval. The workspace records card still
// counts them, labelled as no longer collected, because a record that silently
// stops being listed is worse than one labelled for what it is.
//
// The two assertions that matter are that nothing accepts a submission any more,
// and that no page offers a form that would try.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const app = require("../server.js");
const root = path.join(__dirname, "..");

describe("no intake form is left to submit", () => {
  it("serves no intake page", async () => {
    const response = await request(app).get("/business-builder/intake").set("accept", "text/html");
    assert.equal(response.status, 404, `/business-builder/intake answered ${response.status}`);
  });

  // A GET that 404s while the POST still accepts writes would be the worse half
  // left behind: no page, and an endpoint anybody can still post to.
  it("accepts no intake submission", async () => {
    for (const accept of ["text/html", "application/json"]) {
      const response = await request(app)
        .post("/api/business-builder/intake")
        .set("accept", accept)
        .type("form")
        .send({ name: "A", email: "a@example.com", serviceInterest: "x", message: "y" });
      assert.equal(response.status, 404, `the intake endpoint answered ${response.status} to ${accept}`);
    }
  });

  it("is registered nowhere, so no page can link it", () => {
    const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
    const declared = ROUTE_REGISTRY.map((entry) => entry.route);
    assert.ok(declared.length > 200, `only ${declared.length} routes declared; this check has gone blind`);
    assert.equal(declared.includes("/business-builder/intake"), false, "the intake page is still declared");
  });

  // The form markup, the handler, the save helper, the confirmation email and
  // the helper that made a customer from a submission all went. Asserted by
  // name, because a removal that leaves the builder in place leaves a form one
  // call away from being rendered again.
  it("leaves no intake form builder or write path in server.js", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
    for (const fragment of [
      "businessIntakeForm",
      "saveBusinessBuilderIntake",
      "sendIntakeConfirmationEmail",
      "safeInsertBusinessBuilderCustomerFromIntake",
      '/api/business-builder/intake'
    ]) {
      assert.equal(server.includes(fragment), false, `server.js still contains ${fragment}`);
    }
  });

  it("offers no form anywhere whose action is the intake endpoint", () => {
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".git", ".next"].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(c|m)?js$/.test(entry.name)) files.push(full);
      }
    })(path.join(root, "lib"));
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(c|m)?js$/.test(entry.name)) files.push(full);
      }
    })(path.join(root, "routes"));
    files.push(path.join(root, "server.js"));
    assert.ok(files.length > 100, `only ${files.length} runtime files scanned; this check has gone blind`);
    const offenders = files.filter((file) => /action\s*=\s*\\?["'][^"']*business-builder\/intake/.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(offenders.map((file) => path.relative(root, file)), [], "a form still posts to the intake endpoint");
  });

  // The launch checklist told an owner to do a step that no longer exists.
  it("no longer lists intake as a launch step", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
    assert.equal(
      /\["Business profile", "Offer", "Intake"/.test(server),
      false,
      "the launch checklist still names an intake step"
    );
    // And the checklist is still a checklist, rather than having been emptied.
    assert.match(server, /"Business profile", "Offer", "Pricing"/, "the launch checklist lost more than the intake step");
  });

  // Not deleted, and said so rather than left to be assumed.
  it("still counts the requests a business already collected", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
    assert.match(server, /Intake requests on file \(no longer collected\)/, "historical intake rows stopped being listed");
  });
});
