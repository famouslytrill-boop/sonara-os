"use strict";

// The reset page told people to wait for something that was never going to
// happen.
//
// A password recovery token arrives in the URL fragment, which never reaches
// the server, so only the browser can read it. public/sonara-auth-recovery.js
// lifts it into a hidden field and enables the submit button. If that script is
// blocked, errors, 404s, or is refused by the CSP, none of that happens.
//
// The status line's default text was "Checking the recovery link…". So the
// outcome of the script not running was a page that claimed to be working on
// it, forever, beside a permanently greyed-out button, with nothing to say why.
//
// The person reading it has just clicked a reset link from their email because
// they are already locked out of their account. Being told to wait, with no end
// to the waiting and no alternative offered, is the worst possible thing that
// page could do.
//
// The fix is the same principle the scroll entrance follows: the state a page
// starts in has to be true when nothing upgrades it. The script rewrites this
// line synchronously, so the default is only ever seen when the script did not
// run -- which is exactly the case it now describes.
//
// These checks are about that property, not about the wording.

const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

const root = path.join(__dirname, "..");

function statusLine(html) {
  const match = html.match(/<p[^>]*data-sonara-recovery-status[^>]*>([\s\S]*?)<\/p>/);
  return match ? match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
}

describe("the reset page when its script does not run", () => {
  it("renders the recovery form at all", async () => {
    const res = await request(app).get("/reset-password").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /data-sonara-recovery-form/);
    assert.match(res.text, /data-sonara-recovery-submit/);
  });

  it("does not claim to be checking something it will never check", async () => {
    const res = await request(app).get("/reset-password").set("Accept", "text/html");
    const status = statusLine(res.text);
    assert.ok(status.length > 0, "there is no status line; this check has gone blind");
    assert.doesNotMatch(status, /checking/i, `the page still starts by claiming to be working on it: "${status}"`);
  });

  it("says why the button is disabled", async () => {
    // The submit button ships disabled and is enabled by script. A disabled
    // control with no explanation is indistinguishable from a broken page.
    const res = await request(app).get("/reset-password").set("Accept", "text/html");
    assert.match(res.text, /data-sonara-recovery-submit/);
    assert.match(res.text, /disabled/);
    assert.match(statusLine(res.text), /javascript/i, "nothing explains why the form cannot be used");
  });

  it("offers a way to get the password reset without JavaScript", async () => {
    // The point is not to explain the technology. It is that somebody locked
    // out of their account has somewhere to go.
    const res = await request(app).get("/reset-password").set("Accept", "text/html");
    const status = statusLine(res.text);
    assert.match(status, /contact us|by hand/i, `no alternative is offered: "${status}"`);
  });

  it("carries a noscript block as well", async () => {
    // The status line covers a script that failed to run for any reason. This
    // covers the specific case the browser can tell us about, and is what a
    // reader with scripting off will actually see rendered.
    const res = await request(app).get("/reset-password").set("Accept", "text/html");
    assert.match(res.text, /<noscript>[\s\S]*?<\/noscript>/, "there is no noscript fallback");
    const noscript = res.text.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
    assert.match(noscript, /contact us/i, "the noscript block offers nowhere to go");
  });

  it("is a default the script actually replaces", async () => {
    // If the script did not rewrite this line, the default would show to
    // everybody and the page would be wrong in the opposite direction.
    const script = fs.readFileSync(path.join(root, "public", "sonara-auth-recovery.js"), "utf8");
    assert.match(script, /status\.textContent\s*=/, "the script never rewrites the status line");
    const assignments = script.match(/status\.textContent\s*=\s*"([^"]*)"/g) || [];
    assert.ok(assignments.length >= 2, `the script sets the status ${assignments.length} time(s); both outcomes should be covered`);
    assert.match(script, /verified/i, "the script has no success message");
    assert.match(script, /missing or expired/i, "the script has no expired-link message");
  });
});

// Comments explaining a retired string necessarily contain that string. This
// check failed on its own explanation the first time it ran -- the third time
// that has happened in this suite, so the stripping is deliberate rather than
// incidental.
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function recoverySection() {
  const source = withoutComments(
    fs.readFileSync(path.join(root, "routes", "sonara-route-registry-routes.cjs"), "utf8")
  );
  const start = source.indexOf('app.post("/auth/forgot-password"');
  const end = source.indexOf('app.get("/reset-password"');
  assert.ok(start !== -1 && end > start, "the recovery routes were not found; this check has gone blind");
  return source.slice(start, end);
}

describe("what recovery says when sign-in is not connected", () => {
  it("does not send the customer after an administrator", () => {
    // The pages said "unavailable until the administrator finishes account
    // setup" and "The administrator needs to finish account setup." A customer
    // reading that has no idea who the administrator is or whether it means
    // them. It is our setup and they cannot affect it.
    assert.doesNotMatch(recoverySection(), /administrator/i, "the recovery flow still refers a customer to an administrator");
  });

  it("tells them the one thing they can actually do", () => {
    assert.match(recoverySection(), /contact us/i, "no alternative is offered when recovery is unavailable");
  });
});
