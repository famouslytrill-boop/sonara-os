"use strict";

// A creator profile with a public address, and the follow graph behind it.
//
// creator_artist_profiles has carried `public_description` since the artist
// system landed and nothing had ever put one on a page a stranger could reach,
// so the "public" in that column name was aspirational. It is a page now, and
// this file holds the two properties that decide whether that was safe to do.
//
// **What is published is three fields, and what is not is six.** That table also
// holds private_backstory, voice_identity, genre_blend, writing_rules,
// visual_rules and prompt_rules. Two of those matter more than the naming
// suggests: publishing voice_identity or prompt_rules hands somebody the
// instructions for reproducing an artist's voice, which is the anti-clone rule
// in AGENTS.md and not a preference.
//
// **A handle is an address, so it has to be refused as well as accepted.** A
// handle called `login` or `support` is either a routing problem or an
// impersonation one, and both are cheaper to refuse than to undo.

const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs");

const profiles = require("../lib/sonara-creator-profiles.cjs");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const OTHER_ORG = "bbbbbbbb-0000-4000-8000-00000000000b";
const USER = "11111111-0000-4000-8000-000000000001";
const PROFILE_ID = "cccccccc-0000-4000-8000-00000000000c";
const PRIVATE_PROFILE_ID = "dddddddd-0000-4000-8000-00000000000d";
const OTHER_ORG_PROFILE_ID = "eeeeeeee-0000-4000-8000-00000000000e";

// Distinctive enough that finding one in a page is unambiguous.
const VOICE = "BREATHY-ALTO-WITH-A-SLIGHT-RASP";
const PROMPT_RULES = "NEVER-MENTION-THE-RAIN";
const BACKSTORY = "GREW-UP-IN-A-LIGHTHOUSE";
const PUBLIC_BLURB = "Ambient records made on a boat.";

function seed() {
  return {
    organizations: [{ id: ORG, name: "Shared Co" }, { id: OTHER_ORG, name: "Somebody Else" }],
    organization_memberships: [
      { id: "mem-1", organization_id: ORG, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    creator_artist_profiles: [
      {
        id: PROFILE_ID, organization_id: ORG, artist_name: "Nova", artist_key: "nova",
        public_handle: "nova", published_at: "2026-08-19T10:00:00.000Z", status: "active",
        public_description: PUBLIC_BLURB,
        private_backstory: { note: BACKSTORY },
        voice_identity: { timbre: VOICE },
        genre_blend: { mix: "ambient/dub" },
        writing_rules: { rule: "no rhyme" },
        visual_rules: { palette: "cold" },
        prompt_rules: { rule: PROMPT_RULES }
      },
      {
        id: PRIVATE_PROFILE_ID, organization_id: ORG, artist_name: "Unlisted", artist_key: "unlisted",
        public_handle: null, published_at: null, status: "active", public_description: "Not published.",
        voice_identity: { timbre: VOICE }
      },
      {
        id: OTHER_ORG_PROFILE_ID, organization_id: OTHER_ORG, artist_name: "Theirs", artist_key: "theirs",
        public_handle: null, published_at: null, status: "active"
      }
    ],
    creator_follows: []
  };
}

describe("a public profile publishes three things and withholds six", () => {
  describe("the handle", () => {
    it("accepts an ordinary one and normalizes the case", () => {
      // Stored lowercase, or "Nova" and "nova" become two profiles at one
      // address and the unique index decides which arbitrarily.
      assert.deepEqual(profiles.checkHandle("Nova"), { ok: true, handle: "nova" });
      assert.deepEqual(profiles.checkHandle("  nova-2026 "), { ok: true, handle: "nova-2026" });
    });

    it("refuses a shape that is not an address", () => {
      const refusals = ["", " ", "n", "no", "-nova", "nova-", "no va", "nova!", "NOVA/admin", "a".repeat(33), "nova.co"];
      for (const bad of refusals) {
        assert.equal(profiles.checkHandle(bad).ok, false, `accepted ${JSON.stringify(bad)}`);
      }
      assert.equal(profiles.checkHandle("nova").ok, true, "refused a good handle, so every check above is vacuous");
    });

    it("refuses every top-level path this application serves", () => {
      // Not because /creator/login collides today -- it does not -- but because
      // the cheapest future change is serving profiles from the root, and a
      // handle called `login` would make that impossible rather than awkward.
      const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
      const segments = [...new Set(ROUTE_REGISTRY
        .map((record) => record.route.split("/")[1])
        .filter(Boolean)
        .map((segment) => segment.replace(/\.(xml|txt)$/, "")))];
      assert.ok(segments.length > 20, `only ${segments.length} segments were found; this check has gone blind`);
      const takeable = segments.filter((segment) => profiles.checkHandle(segment).ok);
      assert.deepEqual(takeable, [], `these are routes and somebody could take them as a handle: ${takeable.join(", ")}`);
    });

    it("refuses the words somebody registers in order to be believed", () => {
      for (const word of ["official", "sonara", "support", "admin", "staff", "verified", "payments", "security"]) {
        const checked = profiles.checkHandle(word);
        assert.equal(checked.ok, false, `${word} is available as a handle`);
        // "Not available" rather than "reserved". The second tells somebody
        // guessing at the list that they guessed right.
        assert.match(checked.message, /not available/i, `${word} is refused in a way that confirms the list`);
      }
    });
  });

  describe("what the profile view carries", () => {
    it("carries the name, the public description and the follower count", () => {
      const view = profiles.publicProfileView(seed().creator_artist_profiles[0], 3);
      assert.equal(view.name, "Nova");
      assert.equal(view.description, PUBLIC_BLURB);
      assert.equal(view.followers.total, 3);
    });

    it("carries none of the artist's working material", () => {
      const rendered = JSON.stringify(profiles.publicProfileView(seed().creator_artist_profiles[0], 3));
      for (const secret of [VOICE, PROMPT_RULES, BACKSTORY, ORG, "ambient/dub", "no rhyme", "cold"]) {
        assert.ok(!rendered.includes(secret), `the profile view carries ${secret}`);
      }
      assert.ok(rendered.includes(PUBLIC_BLURB), "the view dropped the public description too, so the check above proves nothing");
    });

    it("names every column that must never be published, and selects none of them", () => {
      assert.ok(profiles.PUBLIC_PROFILE_COLUMNS.length > 0, "nothing is selected, which would make this vacuous");
      assert.ok(profiles.NEVER_PUBLISHED_COLUMNS.length >= 6, "the withheld list is too short to cover the jsonb columns");
      for (const column of ["voice_identity", "prompt_rules", "private_backstory", "genre_blend", "writing_rules", "visual_rules"]) {
        assert.ok(profiles.NEVER_PUBLISHED_COLUMNS.includes(column), `${column} is not on the never-published list`);
        assert.ok(!profiles.PUBLIC_PROFILE_COLUMNS.includes(column), `${column} is selected for a public page`);
      }
    });

    it("is what the route actually selects", () => {
      const source = fs.readFileSync(require.resolve("../routes/sonara-creator-profile-routes.cjs"), "utf8");
      assert.match(source, /PUBLIC_PROFILE_COLUMNS\.join\(","\)/, "the profile page does not select through the reviewed list");
      assert.doesNotMatch(source, /select=\*/, "the profile page selects every column somewhere");
    });

    it("says zero followers in words, and cannot count in different words", () => {
      // "0 followers" under a profile its owner has just published reads as
      // failure. And a count that could not be read is not a count of zero.
      assert.match(profiles.followerSummary(0).sentence, /Nobody is following/i);
      assert.equal(profiles.followerSummary(0).total, 0);
      assert.match(profiles.followerSummary(null).sentence, /could not count/i);
      assert.equal(profiles.followerSummary(null).total, null);
      assert.match(profiles.followerSummary(1).sentence, /1 person follows/);
      assert.match(profiles.followerSummary(4200).sentence, /4,200 people follow/);
    });
  });

  describe("the pages and the graph", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    beforeEach(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    afterEach(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("opens a published profile for somebody with no account", async () => {
      const response = await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a public profile that needs an account is not a public profile");
      assert.ok(response.text.includes("Nova"), "the artist name is missing");
      assert.ok(response.text.includes(PUBLIC_BLURB), "the public description is missing");
    });

    it("publishes none of the working material onto that page", async () => {
      const response = await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      for (const secret of [VOICE, PROMPT_RULES, BACKSTORY, ORG, "ambient/dub"]) {
        assert.ok(!response.text.includes(secret), `the public profile page published ${secret}`);
      }
    });

    it("never asks the database for the working material either", async () => {
      fake.reset();
      await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      const reads = fake.queries.filter((query) => query.table === "creator_artist_profiles");
      assert.ok(reads.length >= 1, "the profile was never read, so this check is vacuous");
      const select = (new URLSearchParams(reads[0].search).get("select") || "").split(",");
      for (const column of profiles.NEVER_PUBLISHED_COLUMNS) {
        assert.ok(!select.includes(column), `the public page asked for ${column}`);
      }
      // By handle, and by nothing the request could influence.
      const columns = reads[0].filters.map((filter) => filter.column).sort();
      assert.deepEqual(columns, ["public_handle", "status"], `the profile read filtered on ${columns.join(", ")}`);
    });

    it("does not open a profile that was never published", async () => {
      // The private row has public_handle null. A filter matching null -- or an
      // unfiltered read taking the first row -- would serve it.
      const response = await request(app).get("/creator/unlisted").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 404);
      assert.ok(!response.text.includes("Unlisted"), "an unpublished profile was served");
    });

    it("invites a stranger to make an account rather than redirecting them", async () => {
      const response = await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.match(response.text, /Create a free account/i, "a stranger is offered no way to follow");
      assert.ok(!/Stop following/.test(response.text), "a stranger was shown an unfollow control");
    });

    it("says following sends nothing, on the page where somebody decides", async () => {
      // AGENTS.md: alerts are off or explicitly user-controlled by default.
      // Saying so where the decision is made is what makes that a promise rather
      // than a setting nobody finds.
      const response = await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      assert.match(response.text, /sends you nothing until you ask it to/i);
    });

    it("answers every press, and asks the database to keep only one follow", async () => {
      // Two halves, and the row count is not the check. The fake PostgREST has
      // no upsert, so counting rows here would measure the harness. What decides
      // this in production is the unique constraint in the migration plus the
      // on_conflict the request carries -- so both are asserted directly, and
      // the route is asserted not to fail on the second press.
      fake.reset();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await request(app)
          .post(`/api/creator-profiles/${PROFILE_ID}/follow`)
          .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
        assert.equal(response.status, 200, `follow ${attempt + 1} answered ${response.status}`);
      }
      const inserts = fake.queries.filter((query) => query.table === "creator_follows" && query.method === "POST");
      assert.equal(inserts.length, 3, "the follows were not all attempted, so the check below is vacuous");
      for (const insert of inserts) {
        assert.match(insert.search, /on_conflict=artist_profile_id%2Cfollower_user_id|on_conflict=artist_profile_id,follower_user_id/,
          "a follow was written without asking the database to merge a duplicate");
      }
      const migration = fs.readFileSync(
        require("node:path").join(__dirname, "..", "supabase", "migrations", "20260819080000_public_creator_profiles_and_follows.sql"),
        "utf8"
      );
      assert.match(migration, /unique \(artist_profile_id, follower_user_id\)/,
        "nothing in the schema stops two rows for one person and one artist");
    });

    it("refuses to follow a profile nobody published", async () => {
      // Otherwise a guessed uuid creates a follow of a private profile, and the
      // follower count on a page nobody can open is a number with no meaning.
      const response = await request(app)
        .post(`/api/creator-profiles/${PRIVATE_PROFILE_ID}/follow`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(response.status, 404);
      assert.equal(fake.rows("creator_follows").length, 0, "an unpublished profile was followed");
    });

    it("refuses a stranger", async () => {
      const response = await request(app)
        .post(`/api/creator-profiles/${PROFILE_ID}/follow`)
        .set("accept", "application/json").send({});
      assert.notEqual(response.status, 200);
      assert.equal(fake.rows("creator_follows").length, 0);
    });

    it("removes only the caller's own follow", async () => {
      await request(app).post(`/api/creator-profiles/${PROFILE_ID}/follow`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      fake.reset();
      await request(app).post(`/api/creator-profiles/${PROFILE_ID}/unfollow`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const deletes = fake.queries.filter((query) => query.table === "creator_follows" && query.method === "DELETE");
      assert.ok(deletes.length >= 1, "nothing was deleted, so this check is vacuous");
      for (const call of deletes) {
        const columns = call.filters.map((filter) => filter.column).sort();
        assert.deepEqual(
          columns,
          ["artist_profile_id", "follower_user_id"],
          `an unfollow filtered on ${columns.join(", ")} -- without the follower, one person could delete another's follow`
        );
      }
    });

    it("says so plainly when there was nothing to unfollow", async () => {
      const response = await request(app).post(`/api/creator-profiles/${PROFILE_ID}/unfollow`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(response.status, 200);
      assert.equal(response.body.code, "was_not_following");
    });

    it("does not publish a profile in another organization", async () => {
      const response = await request(app)
        .post(`/api/creator-profiles/${OTHER_ORG_PROFILE_ID}/publish`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a")
        .send({ handle: "stolen" });
      assert.equal(response.status, 404, `a signed-in customer got ${response.status} for another tenant's profile`);
      const row = fake.rows("creator_artist_profiles").find((entry) => entry.id === OTHER_ORG_PROFILE_ID);
      assert.equal(row.public_handle, null, "another organization's profile was published");
    });

    it("refuses a reserved handle before it reaches the database", async () => {
      fake.reset();
      const response = await request(app)
        .post(`/api/creator-profiles/${PRIVATE_PROFILE_ID}/publish`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a")
        .send({ handle: "admin" });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "handle_reserved");
      const writes = fake.queries.filter((query) => query.table === "creator_artist_profiles" && query.method === "PATCH");
      assert.deepEqual(writes, [], "a reserved handle reached a write");
    });

    it("publishes a profile and the address then opens it", async () => {
      const published = await request(app)
        .post(`/api/creator-profiles/${PRIVATE_PROFILE_ID}/publish`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a")
        .send({ handle: "Unlisted-No-More" });
      assert.equal(published.status, 200);
      assert.equal(published.body.handle, "unlisted-no-more", "the handle was not stored lowercase");
      assert.equal(published.body.path, "/creator/unlisted-no-more");

      const opened = await request(app).get(published.body.path).set("accept", "text/html").redirects(0);
      assert.equal(opened.status, 200, "the address that was just taken does not open");
      assert.ok(opened.text.includes("Unlisted"), "the profile is not on its own page");
    });

    it("takes the address back, and keeps the record that it was public", async () => {
      const response = await request(app)
        .post(`/api/creator-profiles/${PROFILE_ID}/unpublish`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(response.status, 200);
      const row = fake.rows("creator_artist_profiles").find((entry) => entry.id === PROFILE_ID);
      assert.equal(row.public_handle, null, "the handle was not released");
      assert.ok(row.published_at, "when it was published was erased, so the page cannot say it was public once");

      const after = await request(app).get("/creator/nova").set("accept", "text/html").redirects(0);
      assert.equal(after.status, 404, "an unpublished profile still opens");
    });

    it("gives a signed-in person the list of who they follow", async () => {
      await request(app).post(`/api/creator-profiles/${PROFILE_ID}/follow`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const response = await request(app).get("/account/following")
        .set("accept", "text/html").set("Authorization", "Bearer token-a").redirects(0);
      assert.equal(response.status, 200, `the following page answered ${response.status}`);
      assert.ok(response.text.includes("Nova"), "somebody they follow is not on the list");
      assert.ok(response.text.includes("/creator/nova"), "the list does not link to the profile");
    });

    it("refuses the following page to somebody who is not signed in", async () => {
      const response = await request(app).get("/account/following").set("accept", "text/html").redirects(0);
      assert.notEqual(response.status, 200, "anybody could read somebody's follow list");
    });
  });

  describe("nothing sends anybody anything", () => {
    it("has no notification path out of the follow record", () => {
      // AGENTS.md puts sounds, voice, haptics, SMS, push and email alerts off by
      // default. The cheapest way to hold that for a brand-new table is that
      // nothing reads it for that purpose at all -- asserted rather than
      // promised, because a promise in a comment is what stops being true first.
      const source = fs.readFileSync(require.resolve("../routes/sonara-creator-profile-routes.cjs"), "utf8");
      for (const path of ["resend", "sendEmail", "sendSms", "twilio", "push", "notifications"]) {
        assert.ok(!new RegExp(path, "i").test(source), `the follow routes reference ${path}`);
      }
      const migration = fs.readFileSync(
        require("node:path").join(__dirname, "..", "supabase", "migrations", "20260819080000_public_creator_profiles_and_follows.sql"),
        "utf8"
      );
      assert.match(migration, /creator_follows/, "the migration under test is not the one that creates this table");
      assert.doesNotMatch(migration, /create trigger/i, "the follow table has a trigger, which is a path this check cannot see the end of");
    });
  });
});
