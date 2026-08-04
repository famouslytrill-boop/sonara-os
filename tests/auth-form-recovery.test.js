"use strict";

// A refused sign-in used to be a dead end.
//
// It rendered a page titled "Access not completed" with links back to /login
// and /signup -- both of which render empty forms. So mistyping a password also
// cost you the email address you had just typed, and getting back to the form
// took a click.
//
// The message was "Email/password access was not completed.", which is
// engineering phrasing on the screen customers see more than any other, and
// tells somebody who fat-fingered their password nothing about what to do.
//
// Both are fixed by re-rendering the same page with the email still in it. That
// makes the password question load-bearing: the email is safe to give back
// because the person submitting it already knew it, and the password is not,
// because it would then sit in the HTML of a page that a shared screen, a
// screenshot, or a browser cache could keep. Several checks here exist only to
// hold that line.
//
// Rate limits are real on these routes -- login is 10 per 15 minutes per IP and
// per email, signup is 5 per hour -- so every test uses its own IP and its own
// address. Sharing them makes tests fail on 429 and look like the feature
// broke.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const SUPABASE_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

// Configured enough to get past isSupabaseAuthConfigured, pointed somewhere
// that cannot answer. That is the credential-rejection path, which is the one
// a customer with a wrong password takes.
function withUnreachableAuth(run) {
  const original = Object.fromEntries(SUPABASE_KEYS.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const key of SUPABASE_KEYS) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
}

const PASSWORD = "Correct-Horse-Battery-Staple-99";

function postLogin({ ip, email, password = PASSWORD, accept = "text/html" }) {
  return request(app)
    .post("/auth/login")
    .set("Accept", accept)
    .set("x-forwarded-for", ip)
    .type("form")
    .send({ email, password });
}

describe("a refused sign-in", () => {
  it("gives the form back with the email still in it", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() => postLogin({ ip: "198.51.100.11", email: "ada@example.com" }));
    assert.ok(res.status >= 400, `expected a refusal, got ${res.status}`);
    assert.match(res.text, /<form method="post" action="\/auth\/login"/, "there is no form to try again in");
    assert.match(res.text, /name="email" type="email" value="ada@example\.com"/, "the email was lost");
  });

  it("never puts the password back on the page", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() => postLogin({ ip: "198.51.100.12", email: "bea@example.com" }));
    assert.ok(!res.text.includes(PASSWORD), "the submitted password was echoed into the page");
    // Not just absent from the value attribute -- absent from the whole
    // response, including any error text that might quote what was submitted.
    assert.doesNotMatch(res.text, /name="password"[^>]*\svalue=/, "the password field carries a value attribute");
  });

  it("says what happened in a way a screen reader announces", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() => postLogin({ ip: "198.51.100.13", email: "cal@example.com" }));
    assert.match(res.text, /role="alert"/, "the error is not announced");
  });

  it("does not leave the old dead-end page behind", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() => postLogin({ ip: "198.51.100.14", email: "dev@example.com" }));
    assert.doesNotMatch(res.text, /Access not completed/, "the dead-end page is still being rendered");
    assert.doesNotMatch(res.text, /Email\/password access was not completed/, "the engineering phrasing is still shown");
  });

  it("escapes the email it gives back", async function () {
    this.timeout(20000);
    // The email is echoed into an attribute value, so a quote in it must not
    // end the attribute. type="email" does not stop a crafted POST.
    const res = await withUnreachableAuth(() =>
      postLogin({ ip: "198.51.100.15", email: '"><script>alert(1)</script>@example.com' })
    );
    assert.doesNotMatch(res.text, /<script(?![^>]+src=)[^>]*>/i, "an inline script reached the page");
    const eventAttributes = res.text.match(/<[a-z]+[^>]*\son[a-z]+\s*=/gi) || [];
    assert.deepEqual(eventAttributes, [], `an event handler attribute was injected: ${eventAttributes.join(", ")}`);
    assert.match(res.text, /&lt;script&gt;/, "the address was not echoed at all, so nothing was escaped");
  });

  it("tells a wrong password and an unknown address apart to nobody", async function () {
    this.timeout(20000);
    // Enumeration. Whatever Supabase says, the answer a caller sees has to be
    // the same, or the sign-in form becomes a way to find out which addresses
    // are registered. Supabase's own error is discarded upstream; this checks
    // that two different addresses produce byte-identical answers.
    const first = await withUnreachableAuth(() =>
      postLogin({ ip: "198.51.100.16", email: "known@example.com", accept: "application/json" })
    );
    const second = await withUnreachableAuth(() =>
      postLogin({ ip: "198.51.100.17", email: "unknown@example.com", accept: "application/json" })
    );
    assert.equal(first.status, second.status, "the status code differs between two addresses");
    assert.deepEqual(first.body, second.body, "the response body differs between two addresses");
    assert.equal(first.body.code, "auth_not_completed");
  });

  it("says something a customer can act on", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() =>
      postLogin({ ip: "198.51.100.18", email: "eve@example.com", accept: "application/json" })
    );
    const message = String(res.body?.message || "");
    assert.ok(message.length > 0, "the refusal carries no message at all");
    // About the pair, never about which half was wrong -- that would be the
    // enumeration leak again, in prose.
    assert.doesNotMatch(message, /no account|not registered|unknown email|wrong password|incorrect password/i,
      `the message narrows down which half was wrong: "${message}"`);
  });

  it("still answers JSON callers with JSON", async function () {
    this.timeout(20000);
    const res = await withUnreachableAuth(() =>
      postLogin({ ip: "198.51.100.19", email: "fay@example.com", accept: "application/json" })
    );
    assert.equal(res.body.ok, false);
    assert.equal(typeof res.body.code, "string");
    assert.doesNotMatch(String(res.text), /<form/, "a JSON caller was sent a page");
  });
});

describe("a refused signup", () => {
  // Signup checks that sign-in is configured at all before it validates
  // anything, so with no Supabase environment every attempt is 503 and the
  // password floor is never reached. These need auth configured-but-unreachable
  // to exercise the validator, same as the login tests.
  it("gives the form back with the email still in it", async function () {
    this.timeout(20000);
    const rejected = "tinypw1";
    const res = await withUnreachableAuth(() =>
      request(app)
        .post("/auth/signup")
        .set("Accept", "text/html")
        .set("x-forwarded-for", "198.51.100.31")
        .type("form")
        .send({ email: "gus@example.com", password: rejected, confirmPassword: rejected })
    );
    assert.equal(res.status, 400);
    assert.match(res.text, /<form method="post" action="\/auth\/signup"/, "there is no form to try again in");
    assert.match(res.text, /name="email" type="email" value="gus@example\.com"/, "the email was lost");
    assert.ok(!res.text.includes(rejected), "the rejected password was echoed into the page");
  });

  it("keeps the twelve-character floor visible on the form it returns", async function () {
    this.timeout(20000);
    // The returned form has to ask for the same thing the server does, or the
    // customer is refused twice for the same reason.
    const res = await withUnreachableAuth(() =>
      request(app)
        .post("/auth/signup")
        .set("Accept", "text/html")
        .set("x-forwarded-for", "198.51.100.32")
        .type("form")
        .send({ email: "hal@example.com", password: "elevenchar", confirmPassword: "elevenchar" })
    );
    assert.equal(res.status, 400);
    assert.match(res.text, /name="password"[^>]*minlength="12"/);
    assert.match(res.text, /Use at least 12 characters/);
  });
});
