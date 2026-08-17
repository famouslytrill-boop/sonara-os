"use strict";

// "Try again" used to mean "type all of that again".
//
// The contact form accepts up to 4000 characters of free text. A rejected
// submission rendered a separate page stating what was wrong, with a "Try
// again" link back to /contact -- and /contact renders an empty form. So one
// mistyped field threw away everything the person had written.
//
// Nothing failed. The validation was correct, the message was accurate, the
// link worked. It just quietly cost the customer their work, and the more care
// they had put into the message, the more it cost. Someone describing their
// business in detail was penalised hardest.
//
// The form now comes back with what was submitted still in it. Which means the
// server is echoing arbitrary visitor input into HTML -- into attribute values,
// into a <textarea>, and into a <select> -- so the escaping is not a detail
// here, it is the reason this file spends more assertions on injection than on
// the feature.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const GOOD = {
  name: "Ada Kowalski",
  email: "ada@example.com",
  subject: "Bookings and stock in one place",
  category: "billing",
  message:
    "We run a small pottery studio and want to take bookings online, sell glazes, and keep a record of repeat customers without paying for four separate tools.",
  consent: "yes"
};

function submit(overrides = {}) {
  return request(app)
    .post("/contact")
    .type("form")
    .set("Accept", "text/html")
    .send({ ...GOOD, ...overrides });
}

describe("a rejected contact request", () => {
  it("is rejected, so the rest of this file is testing the path it claims to", async () => {
    const res = await submit({ email: "not-an-email" });
    assert.equal(res.status, 400);
    assert.match(res.text, /Enter a valid email address/);
  });

  it("says what is wrong in a way a screen reader announces", async () => {
    const res = await submit({ email: "not-an-email" });
    assert.match(res.text, /role="alert"/, "the error is not announced");
  });

  it("gives back every field the customer filled in", async () => {
    const res = await submit({ email: "not-an-email" });
    assert.match(res.text, /name="name" type="text" value="Ada Kowalski"/, "the name was lost");
    assert.match(res.text, /value="Bookings and stock in one place"/, "the subject was lost");
    assert.ok(res.text.includes(GOOD.message), "the message was lost -- this is the whole point");
    assert.match(res.text, /<option value="billing" selected>/, "the chosen category was lost");
    assert.match(res.text, /name="consent"[^>]*checked/, "the consent tick was lost");
  });

  it("gives back the field that was wrong, rather than blanking it", async () => {
    // Blanking the offending field is a common half-fix and it is the wrong
    // one: the customer cannot see what they typed, so they cannot see the
    // typo either.
    const res = await submit({ email: "ada@example" });
    assert.match(res.text, /name="email" type="email" value="ada@example"/, "the rejected value was blanked");
  });

  it("returns a real form, not a dead end", async () => {
    const res = await submit({ message: "too short" });
    assert.match(res.text, /<form method="post" action="\/contact"/, "there is no form to resubmit");
    assert.match(res.text, /<textarea name="message"/, "the message field is gone");
  });

  it("escapes what it gives back", async () => {
    const res = await submit({
      email: "still-bad",
      name: '"><script>alert(1)</script>',
      subject: '"onmouseover="alert(2)',
      message: "</textarea><img src=x onerror=alert(3)>0123456789"
    });
    assert.equal(res.status, 400);

    // No inline script anywhere. The CSP is script-src 'self', so an inline
    // script would not execute -- but relying on that would mean relying on a
    // header to cover an escaping bug.
    assert.doesNotMatch(res.text, /<script(?![^>]+src=)[^>]*>/i, "an inline script reached the page");

    // No event handler attribute in real markup. This is the assertion that
    // catches an attribute break-out, which is what an unescaped quote in a
    // value="" would give you.
    const eventAttributes = res.text.match(/<[a-z]+[^>]*\son[a-z]+\s*=/gi) || [];
    assert.deepEqual(eventAttributes, [], `an event handler attribute was injected: ${eventAttributes.join(", ")}`);

    // The textarea must not be closable from inside its own content.
    assert.doesNotMatch(res.text, /<\/textarea><img/i, "the textarea was closed by its own content");

    // And the payloads are present as text, so this is testing escaping rather
    // than the input having been dropped.
    assert.match(res.text, /&lt;script&gt;alert\(1\)/, "the name was not echoed at all, so nothing was escaped");
    assert.match(res.text, /&lt;\/textarea&gt;&lt;img/, "the message was not echoed at all, so nothing was escaped");
  });

  it("does not treat an unknown category as a chosen one", async () => {
    const res = await submit({ category: "not-a-category" });
    assert.equal(res.status, 400);
    assert.doesNotMatch(res.text, /value="not-a-category"/, "an unknown category was written into the select");
    // Scoped to this form's own select. Scanning the whole page also picks up
    // the settings dialog's language and theme selects, which have nothing to
    // do with the contact category and made this check meaningless.
    const select = res.text.slice(res.text.indexOf('<select name="category"'));
    const options = [...select.slice(0, select.indexOf("</select>")).matchAll(/<option value="([a-z]+)"/g)].map((match) => match[1]);
    assert.deepEqual(options.sort(), ["billing", "contact", "feedback", "support"]);
  });

  it("still accepts a valid request", async () => {
    // The guard against fixing the failure path by breaking the success path.
    //
    // This used to assert 200 and "Request received|Request queued". Nothing is
    // configured in this suite, so the request reached neither the database nor
    // the notification email, and "Request queued" was the page saying it had
    // gone into a fallback queue that does not exist. The guard is about
    // validation -- that a good submission is not sent back as a bad one -- so
    // it now checks that, and checks the outcome page honestly.
    const res = await submit();
    assert.notEqual(res.status, 400, "a valid submission was rejected as invalid");
    assert.doesNotMatch(res.text, /<textarea name="message"/, "a valid submission was sent back to the form");
    assert.match(res.text, /Request received|did not go through/);
  });

  it("tells a valid submitter the truth when nothing could take the request", async () => {
    // Nothing is configured here, so this is the real outcome rather than a
    // contrived one. 503 rather than 200, because a caller reading only the
    // status code must not record a vanished request as a filed one.
    const res = await submit();
    assert.equal(res.status, 503);
    assert.match(res.text, /did not go through/);
    assert.doesNotMatch(res.text, /queue/i, "the page still describes a queue that does not exist");
    assert.doesNotMatch(res.text, /Reference ID/, "a reference number was given for a request that was never recorded");
  });

  it("answers JSON callers with JSON, not a page", async () => {
    const res = await request(app)
      .post("/contact")
      .set("Accept", "application/json")
      .send({ ...GOOD, email: "not-an-email" });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, "validation_failed");
  });
});
