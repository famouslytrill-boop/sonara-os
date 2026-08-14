"use strict";

// Being on the page and being findable are different properties.
//
// The password reset link was reachable from /login: routes/customer-ready-experience.cjs
// appends it when it is not already present. But appended means immediately
// before </main>, which put it below the sign-in card and two marketing cards.
//
// Measured on the rendered page, not estimated: the password field sat at 53%
// of the way down the main element and the link at 98%. Somebody who cannot
// remember their password is looking at the password field. They are not
// scrolling past "One connected workspace" and "Private by default" to find
// help.
//
// A test already asserted href="/forgot-password" appeared in the page, and it
// did. That check was true and useless, which is the failure mode these files
// keep running into: a signal that reports success without the thing being so.
//
// So this measures position rather than presence. The link now renders inside
// the form next to the password field, and the injection self-disables because
// it only fires when the link is absent.
//
// The rate limit page is the same person a few attempts later. It said "Wait
// about 1 minute(s)" -- a template shortcut that reached customers -- and
// offered Home and Get help. Almost everybody who trips a login rate limit has
// forgotten their password: that is what repeated failed attempts are.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

function mainElement(html) {
  return html.slice(html.indexOf("<main"), html.indexOf("</main>"));
}

describe("finding the password reset from the sign-in page", () => {
  it("offers the link at all", async () => {
    const res = await request(app).get("/login").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /href="\/forgot-password"/);
  });

  it("comes before the marketing cards it used to sit beneath", async () => {
    // The concrete regression, rather than a percentage. The injected link
    // landed just before </main>, which put it after "One connected workspace"
    // and "Private by default". Those two cards are what the reader had to
    // scroll past to find help with their password.
    //
    // An earlier version of this check measured character distance from the
    // password field and required it to be under 15% of the document. That
    // number was invented, and character distance is a poor stand-in for
    // visual distance anyway -- the password input, its hint and the show-password
    // button are a lot of markup for a small area of screen, which put the
    // link at 21% while sitting directly beneath the field. Position relative
    // to named landmarks says what was actually wrong.
    const main = mainElement((await request(app).get("/login").set("Accept", "text/html")).text);
    const reset = main.indexOf('href="/forgot-password"');
    const firstMarketingCard = main.indexOf("One connected workspace");
    assert.ok(reset !== -1, "no reset link found");
    assert.ok(firstMarketingCard !== -1, "the marketing cards were not found; this check has gone blind");
    assert.ok(
      reset < firstMarketingCard,
      "the reset link still renders below the marketing cards, which is where nobody looking for it will scroll"
    );
  });

  it("comes after the password field, not before it", async () => {
    const main = mainElement((await request(app).get("/login").set("Accept", "text/html")).text);
    const password = main.indexOf('name="password"');
    const reset = main.indexOf('href="/forgot-password"');
    assert.ok(password !== -1, "no password field found; this check has gone blind");
    assert.ok(reset > password, "the reset link renders above the password field, before there is anything to forget");
  });

  it("renders it inside the sign-in form", async () => {
    // The strongest version of "findable": in the form the person is filling
    // in, not merely near it.
    const main = mainElement((await request(app).get("/login").set("Accept", "text/html")).text);
    const form = main.slice(main.indexOf('<form method="post" action="/auth/login"'));
    const formEnd = form.indexOf("</form>");
    assert.ok(formEnd > 0, "the sign-in form was not found");
    assert.match(form.slice(0, formEnd), /href="\/forgot-password"/, "the reset link is outside the sign-in form");
  });

  it("does not end up on the page twice", async () => {
    // The injection in routes/customer-ready-experience.cjs only fires when the
    // link is absent, so rendering it in the form should switch that branch off
    // rather than produce two links.
    const text = (await request(app).get("/login").set("Accept", "text/html")).text;
    const occurrences = (text.match(/href="\/forgot-password"/g) || []).length;
    assert.equal(occurrences, 1, `the reset link appears ${occurrences} times`);
  });

  it("is not offered on the signup page, where it means nothing", async () => {
    const main = mainElement((await request(app).get("/signup").set("Accept", "text/html")).text);
    const form = main.slice(main.indexOf('<form method="post" action="/auth/signup"'));
    assert.doesNotMatch(form.slice(0, form.indexOf("</form>")), /forgot-password/, "the signup form offers a password reset");
  });

  it("still resolves", async () => {
    // A link is only findable if it goes somewhere.
    const res = await request(app).get("/forgot-password").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(res.text, /<form[^>]*action="\/auth\/forgot-password"/);
  });
});

describe("the page after too many sign-in attempts", () => {
  const { createRateLimiter } = require("../lib/sonara-rate-limit.cjs");
  assert.ok(typeof createRateLimiter === "function");

  // Rendered directly rather than by exhausting a real limiter, which would
  // need eleven requests and would leave the limiter tripped for other tests.
  function render(_retryAfterSeconds) {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
    const start = source.indexOf("function renderRateLimitPage");
    return source.slice(start, source.indexOf("\n}", start));
  }

  it("does not say minute(s)", () => {
    const body = render();
    assert.doesNotMatch(body, /minute\(s\)/, "the parenthesised plural is still shown to customers");
    assert.match(body, /about a minute/, "there is no singular form");
  });

  it("offers the password reset, which is what the person actually needs", () => {
    const body = render();
    assert.match(body, /\/forgot-password/, "the rate limit page does not offer a password reset");
  });

  it("says the account is not the problem", () => {
    // Being told to wait with no explanation reads as though something is wrong
    // with your account rather than as a limit that applies to everyone.
    assert.match(render(), /not a problem with your account/i);
  });

  it("still answers non-HTML callers with the limiter's own response", () => {
    // renderRateLimitPage returns false for a JSON caller so the limiter falls
    // back to its 429 body. Changing the page must not swallow that.
    assert.match(render(), /if \(!acceptsHtml\(req\)\) return false;/);
  });
});
