"use strict";

// The strict password rule was avoidable by taking the other route.
//
// Resetting a password required 12 characters. Signing up required 8. Both set
// a password, so anyone who wanted a short one could simply sign up rather than
// reset, and the 12-character rule protected nothing it was meant to.
// docs/legal/COUNSEL_REVIEW_BRIEF.md records it as finding F-4.
//
// Signup now matches reset. The interesting part is what did NOT move.
//
// lib/sonara-customer-auth.cjs serves signup and login from one function.
// Raising the floor there for both modes would refuse the existing password of
// every customer who set one between 8 and 11 characters -- locking them out at
// the sign-in screen, unable to reach the reset flow that would let them fix
// it. A password already in use is not made safer by refusing to accept it; it
// just stops being usable by the person it belongs to.
//
// So there are two floors on purpose, and these checks exist to stop somebody
// "tidying" them into one.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

describe("the password floor", () => {
  const auth = read("lib/sonara-customer-auth.cjs");
  const reset = read("routes/sonara-route-registry-routes.cjs");

  it("asks for the same length everywhere a password is chosen", () => {
    const chosen = /NEW_PASSWORD_MIN_LENGTH = (\d+)/.exec(auth);
    assert.ok(chosen, "the signup floor is no longer a named constant");
    assert.equal(Number(chosen[1]), 12);

    // The reset route states its own floor inline; both must agree, or the
    // stricter one is avoidable again by taking the other route.
    const handler = reset.slice(reset.indexOf('app.post("/auth/reset-password"'), reset.indexOf('app.get("/account/profile"'));
    assert.match(handler, /password\.length < 12/, "the reset floor no longer matches the signup floor");
  });

  it("keeps a lower floor for a password already in use", () => {
    const existing = /EXISTING_PASSWORD_MIN_LENGTH = (\d+)/.exec(auth);
    assert.ok(existing, "the login floor is no longer a named constant");
    assert.equal(Number(existing[1]), 8);
    assert.ok(
      Number(existing[1]) < 12,
      "login now demands the new-password length, which locks out every customer whose existing password is shorter"
    );
    assert.match(auth, /mode === "signup" \? NEW_PASSWORD_MIN_LENGTH : EXISTING_PASSWORD_MIN_LENGTH/);
  });

  // The auth routes answer 503 setup_required before validating anything when
  // Supabase auth is unconfigured, which it is by default in the suite. Without
  // this, both checks below would pass on a 503 and prove nothing about the
  // password floor at all. The address is a closed port so no request leaves
  // the machine -- these cases must not reach validation-then-network.
  const savedEnv = {};
  const authEnv = {
    SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_ANON_KEY: "anon-key-for-password-floor-test-1234567890"
  };

  before(() => {
    for (const [key, value] of Object.entries(authEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = value;
    }
  });

  after(() => {
    for (const key of Object.keys(authEnv)) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("rejects a short new password at signup", async function signupShort() {
    this.timeout(20000);
    const response = await request(app)
      .post("/auth/signup")
      .set("accept", "application/json")
      // Signup allows 5 attempts per hour per IP. Without a distinct client
      // identifier these requests spend the shared budget and an unrelated
      // test later in the suite gets 429 instead of what it asserts -- which
      // is exactly what happened the first time this file ran.
      .set("x-forwarded-for", "203.0.113.41")
      .send({ email: "someone@example.com", password: "short123", confirmPassword: "short123" });
    assert.equal(response.status, 400, "signup did not reach password validation; check the setup gate");
    assert.equal(response.body.code, "validation_failed");
    assert.match(response.body.message, /12 characters/);
  });

  it("does not reject a short existing password at login", async function loginShort() {
    this.timeout(20000);
    // Length must not be what refuses this. An 8-character password has to
    // reach the credential check rather than being turned away by the
    // validator, or an existing customer cannot sign in at all. The credential
    // check then fails, because the address is a closed port -- that is the
    // expected outcome here and it is a different failure from the one being
    // guarded against.
    const response = await request(app)
      .post("/auth/login")
      .set("accept", "application/json")
      .set("x-forwarded-for", "203.0.113.42")
      .send({ email: "someone@example.com", password: "short123" });
    assert.notEqual(response.body?.code, "validation_failed", "login refused an 8-character password on length, locking out existing customers");
    assert.equal(response.body?.code, "auth_not_completed", "login did not reach the credential check");
  });

  it("asks the browser for the same thing the server asks for", async function forms() {
    this.timeout(20000);
    // A form that accepts less than the server does produces a rejection the
    // person cannot see coming; a form that demands more than the server does
    // blocks a valid password before it is ever sent.
    const signup = await request(app).get("/signup").set("accept", "text/html");
    assert.equal(signup.status, 200);
    assert.match(signup.text, /name="password"[^>]*minlength="12"/);
    assert.match(signup.text, /name="confirmPassword"[^>]*minlength="12"/);
    assert.match(signup.text, /Use at least 12 characters/);

    const login = await request(app).get("/login").set("accept", "text/html");
    assert.equal(login.status, 200);
    assert.match(login.text, /name="password"[^>]*minlength="8"/);
    assert.doesNotMatch(login.text, /Use at least 12 characters/, "the login form demands a length existing customers may not have");
  });
});
