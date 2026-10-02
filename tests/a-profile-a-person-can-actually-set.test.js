"use strict";

// /account/profile had no form on it.
//
// It was served, it was signed-in, and it rendered the account's email beside a
// card reading "This feature works, but saving needs your records connected by an
// administrator first." `public.profiles.full_name` had existed since migration
// 011 and no route in this repository had ever written it. The sentence read as
// "come back later" on a page where nothing was coming.
//
// Three things have to stay true of the replacement, and each has a way of
// quietly stopping:
//
// **A file is what its bytes say, not what it is called.** A .png that is an HTML
// file is a stored object that renders as nothing, and renders as whatever it
// actually is if the bucket is ever public.
//
// **A failed read is not an empty profile.** Drawing blank boxes over somebody's
// saved profile invites them to retype what they already have.
//
// **A page must not say "saved" when it has not saved.** The upload has two steps
// -- the object and the row -- and reporting the first as the whole thing is this
// repository's recurring defect with a picture attached.

const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const profiles = require("../lib/sonara-user-profile.cjs");
const registerAccountProfileRoutes = require("../routes/sonara-account-profile-routes.cjs");

const root = path.join(__dirname, "..");
const PAGE = "/account/profile";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const GIF87 = Buffer.concat([Buffer.from("GIF87a", "latin1"), Buffer.alloc(64, 7)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1"), Buffer.alloc(64, 7)]);
const NOT_AN_IMAGE = Buffer.from(`<html><body>${"x".repeat(80)}</body></html>`);

describe("a profile a person can actually set", () => {
  describe("a picture is judged on its bytes", () => {
    it("accepts the four types the page offers", () => {
      const seen = new Set();
      for (const bytes of [PNG, JPEG, GIF87, WEBP]) {
        const verdict = profiles.acceptAvatar({ bytes, filename: "picture" });
        assert.equal(verdict.ok, true, `${verdict.code}: ${verdict.message}`);
        seen.add(verdict.type);
      }
      assert.equal(seen.size, 4, `only ${seen.size} distinct types read from four files`);
      // The page must offer exactly what the module accepts. A page naming a type
      // the module refuses is the advertise-then-refuse shape with a file picker.
      assert.deepEqual([...profiles.ACCEPTED_AVATAR_TYPES].sort(), [...seen].sort());
    });

    it("refuses an HTML file called me.png", () => {
      const verdict = profiles.acceptAvatar({ bytes: NOT_AN_IMAGE, filename: "me.png" });
      assert.equal(verdict.ok, false);
      assert.equal(verdict.code, profiles.AVATAR_REFUSED.not_an_image);
    });

    it("does not tell the uploader what it worked out the file was", () => {
      const verdict = profiles.acceptAvatar({ bytes: NOT_AN_IMAGE, filename: "me.png" });
      // Naming the real type is a puzzle to everybody who made an honest mistake
      // and a hint to the one person who did not.
      assert.doesNotMatch(verdict.message, /html/i);
    });

    it("refuses an empty file and says which problem it is", () => {
      assert.equal(profiles.acceptAvatar({ bytes: Buffer.alloc(0) }).code, profiles.AVATAR_REFUSED.empty);
    });

    it("refuses one over the limit and says what the limit is", () => {
      const verdict = profiles.acceptAvatar({ bytes: Buffer.alloc(profiles.AVATAR_MAX_BYTES + 1) });
      assert.equal(verdict.code, profiles.AVATAR_REFUSED.too_large);
      assert.match(verdict.message, new RegExp(String(profiles.AVATAR_MAX_BYTES / 1024)));
    });

    it("accepts one exactly at the limit", () => {
      const atLimit = Buffer.concat([PNG, Buffer.alloc(profiles.AVATAR_MAX_BYTES - PNG.length)]);
      assert.equal(atLimit.length, profiles.AVATAR_MAX_BYTES);
      assert.equal(profiles.acceptAvatar({ bytes: atLimit }).ok, true);
    });

    it("uses the shared sniffer rather than a second one of its own", () => {
      const source = fs.readFileSync(path.join(root, "lib", "sonara-user-profile.cjs"), "utf8");
      assert.match(source, /require\("\.\/sonara-multipart\.cjs"\)/);
      // The first draft wrote its own signature table, which missed GIF87a and
      // had no minimum-length guard. GIF87a is in the accepted set above, so this
      // assertion has teeth: a re-added private table that missed it would fail
      // the first test in this file.
      assert.doesNotMatch(source, /IMAGE_SIGNATURES|0x89, 0x50/);
    });
  });

  describe("how somebody is shown, and whether they chose it", () => {
    it("says a set name is set", () => {
      assert.deepEqual(profiles.displayName({ display_name: "Dawn" }, { email: "d@example.com" }), { text: "Dawn", source: "set" });
    });

    it("falls back to the email local part and says that is what it did", () => {
      const shown = profiles.displayName({}, { email: "Dawn.Taylor@example.com" });
      assert.equal(shown.source, "email");
      assert.equal(shown.text, "Dawn.Taylor");
    });

    it("invents nothing when it has neither", () => {
      const shown = profiles.displayName({}, {});
      assert.equal(shown.source, "unknown");
      // Not "Anonymous", not "there". A stand-in reads as a choice somebody made.
      assert.equal(shown.text, "");
    });

    it("treats a whitespace-only name as unset", () => {
      assert.equal(profiles.displayName({ display_name: "   " }, { email: "d@example.com" }).source, "email");
    });

    it("strips control characters out of a name", () => {
      const fields = profiles.profileFieldsFrom({ displayName: "Da\u0000wn\u001f" });
      assert.doesNotMatch(fields.display_name, /[\u0000-\u001f]/);
    });

    it("clears a field somebody emptied rather than keeping the old value", () => {
      const fields = profiles.profileFieldsFrom({ displayName: "", headline: "   ", bio: "" });
      // null, not "". The column holds "not set" rather than "set to nothing".
      assert.equal(fields.display_name, null);
      assert.equal(fields.headline, null);
      assert.equal(fields.bio, null);
    });

    it("holds each field to its own length", () => {
      const fields = profiles.profileFieldsFrom({
        displayName: "n".repeat(500),
        headline: "h".repeat(500),
        bio: "b".repeat(5000)
      });
      assert.equal(fields.display_name.length, profiles.DISPLAY_NAME_MAX);
      assert.equal(fields.headline.length, profiles.HEADLINE_MAX);
      assert.equal(fields.bio.length, profiles.BIO_MAX);
    });
  });

  describe("an unreadable profile is not an empty one", () => {
    it("reports unreadable as its own state", () => {
      const state = profiles.profileCompleteness({ readable: false });
      assert.equal(state.readable, false);
      // null, not false. "We could not tell" is not "incomplete".
      assert.equal(state.complete, null);
      assert.deepEqual(state.missing, []);
    });

    it("reports an empty profile as readable and incomplete", () => {
      const state = profiles.profileCompleteness({ profile: {} });
      assert.equal(state.readable, true);
      assert.equal(state.complete, false);
      assert.equal(state.missing.length, 4);
    });

    it("reports a filled profile as complete", () => {
      const state = profiles.profileCompleteness({
        profile: { display_name: "Dawn", avatar_path: "person/x/avatar/y.png", headline: "Plumber", bio: "Leeds" }
      });
      assert.equal(state.complete, true);
      assert.deepEqual(state.missing, []);
    });

    it("does not read a missing profile row as a failed read", () => {
      // A person who has never saved anything has no row. That is readable and
      // empty, and the page should invite an edit rather than apologise.
      const state = profiles.profileCompleteness({ profile: null, readable: true });
      assert.equal(state.readable, true);
      assert.equal(state.complete, false);
    });
  });

  describe("the page itself", () => {
    const USER = { id: "33333333-3333-3333-3333-333333333333", email: "dawn@example.com" };

    function appWith({ profileRow = null, profileOk = true } = {}) {
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      const layout = (input) => `<!doctype html><title>${input.title}</title><h1>${input.heading}</h1><p>${input.body}</p>${(input.sections || []).join("")}`;
      registerAccountProfileRoutes(app, {
        layout,
        brandCard: (title, body) => `<section class="card"><h2>${title}</h2><p>${body}</p></section>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        responsePage: (title, body) => `<!doctype html><title>${title}</title><p>${body}</p>`,
        escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
        requireCustomer: (req, res, next) => { req.sonaraUser = USER; next(); },
        getSupabaseServerConfig: () => ({ ok: profileOk, url: "https://example.invalid", serviceRoleKey: "test" }),
        supabaseHeaders: () => ({})
      });
      // The fetch the route uses to read the profile, stubbed at the module
      // boundary rather than by rewriting the route.
      const realFetch = global.fetch;
      global.fetch = async (url) => {
        if (String(url).includes("/rest/v1/profiles?select=")) {
          return { ok: true, json: async () => (profileRow ? [profileRow] : []) };
        }
        return { ok: true, json: async () => [] };
      };
      return { app, restore: () => { global.fetch = realFetch; } };
    }

    it("offers a form with the three fields and a file picker", async () => {
      const { app, restore } = appWith({});
      try {
        const response = await request(app).get(PAGE).set("accept", "text/html");
        assert.equal(response.status, 200);
        assert.match(response.text, /name="displayName"/);
        assert.match(response.text, /name="headline"/);
        assert.match(response.text, /name="bio"/);
        assert.match(response.text, /type="file"/);
        assert.match(response.text, /enctype="multipart\/form-data"/);
      } finally {
        restore();
      }
    });

    it("no longer carries the sentence that stood in for the form", async () => {
      const { app, restore } = appWith({});
      try {
        const response = await request(app).get(PAGE).set("accept", "text/html");
        // The exact copy that was on the page while nothing could be saved.
        assert.doesNotMatch(response.text, /saving needs your records connected by an administrator/i);
      } finally {
        restore();
      }
    });

    it("says what it falls back to when no name is set", async () => {
      const { app, restore } = appWith({ profileRow: { id: USER.id, email: USER.email } });
      try {
        const response = await request(app).get(PAGE).set("accept", "text/html");
        assert.match(response.text, /have not set a name/i);
        assert.match(response.text, /dawn/);
      } finally {
        restore();
      }
    });

    it("draws no empty form over a profile it could not read", async () => {
      const { app, restore } = appWith({ profileOk: false });
      try {
        const response = await request(app).get(PAGE).set("accept", "text/html");
        assert.equal(response.status, 200);
        assert.match(response.text, /could not read your profile/i);
        assert.match(response.text, /Nothing has been changed or lost/i);
        // The decisive assertion. A blank form here would invite somebody to
        // retype a profile they had already saved.
        assert.doesNotMatch(response.text, /name="displayName"/);
      } finally {
        restore();
      }
    });

    it("sends somebody with no picture back to the page that says so", async () => {
      const none = appWith({ profileRow: { id: USER.id } });
      try {
        const response = await request(none.app).get(`${PAGE}/picture`).set("accept", "text/html");
        // A 404 was the first version. It is correct about the resource and a dead
        // end on somebody's own account page, and it made this the one route in
        // tests/signed-in-workspace-crawl.test.js that did not resolve.
        assert.equal(response.status, 303);
        assert.equal(response.headers.location, PAGE);
      } finally {
        none.restore();
      }
    });

    it("does not send somebody whose profile could not be read back as though they had no picture", async () => {
      const broken = appWith({ profileOk: false });
      try {
        const response = await request(broken.app).get(`${PAGE}/picture`).set("accept", "text/html");
        // The decisive one. A redirect here would be indistinguishable from
        // "you have no picture", which is a definite statement about somebody's
        // own data made on the strength of a request that did not happen.
        assert.equal(response.status, 503);
        assert.notEqual(response.headers.location, PAGE);
        assert.match(response.text, /not the same as having no picture/i);
      } finally {
        broken.restore();
      }
    });

    it("refuses an upload that is not a picture, and says so on the page", async () => {
      const { app, restore } = appWith({});
      try {
        const response = await request(app)
          .post(`${PAGE}/picture`)
          .attach("picture", NOT_AN_IMAGE, { filename: "me.png", contentType: "image/png" });
        assert.equal(response.status, 400);
        assert.match(response.text, /not a picture we can read/i);
      } finally {
        restore();
      }
    });

    it("refuses an upload with no file attached", async () => {
      const { app, restore } = appWith({});
      try {
        const response = await request(app)
          .post(`${PAGE}/picture`)
          .field("something", "else");
        assert.equal(response.status, 400);
        assert.match(response.text, /No picture was attached/i);
      } finally {
        restore();
      }
    });

    it("registers every dependency it needs rather than failing at the first request", () => {
      for (const missing of ["layout", "brandCard", "linkAction", "responsePage", "escapeHtml", "requireCustomer", "getSupabaseServerConfig", "supabaseHeaders"]) {
        const deps = {
          layout: () => "", brandCard: () => "", linkAction: () => "", responsePage: () => "",
          escapeHtml: () => "", requireCustomer: (req, res, next) => next(),
          getSupabaseServerConfig: () => ({}), supabaseHeaders: () => ({})
        };
        delete deps[missing];
        assert.throws(() => registerAccountProfileRoutes(express(), deps), new RegExp(missing), `registering without ${missing} did not throw`);
      }
    });
  });

  describe("the route is wired and accounted for", () => {
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

    it("is required and called in server.js", () => {
      assert.ok(server.includes("sonara-account-profile-routes.cjs"), "server.js does not require the profile routes");
      assert.match(server, /registerAccountProfileRoutes\(app,/, "server.js requires the module and never calls it");
    });

    it("has exactly one handler for /account/profile", () => {
      const files = fs.readdirSync(path.join(root, "routes")).filter((name) => name.endsWith(".cjs"));
      let handlers = 0;
      for (const name of [...files.map((n) => path.join(root, "routes", n)), path.join(root, "server.js")]) {
        const source = fs.readFileSync(name, "utf8");
        handlers += (source.match(/app\.get\((?:PROFILE_PAGE|"\/account\/profile")/g) || []).length;
      }
      // Two handlers for one path means Express serves whichever registered
      // first, which is how the read-only page would have kept winning.
      assert.equal(handlers, 1, `${handlers} handlers for /account/profile`);
    });
  });
});
