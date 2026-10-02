"use strict";

// The Creator Studio project graph, and the three things it refuses.
//
// **An approval belongs to one version, not to the asset.** If it attached to the
// asset, approving v1 would clear v2, v3 and every later edit -- a gate that was
// asked once and then answered for work nobody saw. The schema assertion lives in
// scripts/verify-supabase-contract.mjs; this file asserts the behaviour, because a
// foreign key pointing at the right table is not the same as a decision function
// that reads it.
//
// **An absent disclosure is not "no".** `ai_disclosure` is nullable on purpose and
// has three states: declared AI, declared human, and nobody has answered. The
// defect this is written against is the cheapest one in this repository to ship:
// `Boolean(row.ai_disclosure)` reads an unanswered question as "this is not
// AI-generated", which is a provenance claim made on a creator's behalf. AGENTS.md
// requires provenance and consent safety, and that is this case exactly.
//
// **A read that failed is not an empty library.** `{ ok, rows }` throughout, so a
// 500 from PostgREST renders as a 500 rather than as "you have made nothing".
//
// The route assertions drive the route module with the workspace guard stubbed.
// Through server.js each of them would pass over a 303 from
// requireWorkspaceAccess("creator_studio") and assert nothing about the handler.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerCreatorProjectGraphRoutes = require("../routes/sonara-creator-project-graph-routes.cjs");
const {
  VERSION_SOURCES, MACHINE_SOURCES, APPROVAL_STATES, BRIEF_STATUSES, BRIEF_INTENTS,
  DISCLOSURE, TITLE_MAX, NOTE_MAX,
  nextVersionNumber, disclosureOf, madeByMachine, approvalStateOf, publishReadiness,
  graphForBrief, normalizeBrief, problemSentence
} = require("../lib/sonara-creator-project-graph.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const BRIEF = "c3c3c3c3-0000-4000-8000-00000000003c";
const ASSET = "d4d4d4d4-0000-4000-8000-00000000004d";
const VERSION = "e5e5e5e5-0000-4000-8000-00000000005e";
const PAGE = "/creator-studio/owner/project-graph";

const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20261002010000_creator_project_graph.sql");

function version(overrides = {}) {
  return { id: VERSION, assetId: ASSET, versionNumber: 1, source: "uploaded", aiDisclosure: null, provenance: null, note: null, ...overrides };
}
function approval(overrides = {}) {
  return { id: "ap-1", versionId: VERSION, state: "approved", decidedBy: USER, decidedAt: "2026-10-01T10:00:00.000Z", createdAt: "2026-10-01T09:00:00.000Z", ...overrides };
}

function buildApp({
  briefs = [{ id: BRIEF, title: "Autumn single", summary: "Three tracks.", intent: "original", status: "open", created_at: "2026-09-01T00:00:00.000Z" }],
  assets = [{ id: ASSET, title: "Cover art", asset_type: "image", status: "draft", brief_id: BRIEF }],
  versions = [{ id: VERSION, asset_id: ASSET, version_number: 1, source: "generated", ai_disclosure: null, provenance: null, note: null, created_at: "2026-09-02T00:00:00.000Z" }],
  approvals = [{ id: "ap-1", asset_version_id: VERSION, state: "approved", note: null, decided_by: USER, decided_at: "2026-09-03T00:00:00.000Z", created_at: "2026-09-03T00:00:00.000Z" }],
  briefsOk = true, assetsOk = true, versionsOk = true, approvalsOk = true,
  writeOk = true,
  organization = ORG,
  configOk = true
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    calls.push({ href, method, body: init?.body ? JSON.parse(init.body) : null });

    if (method === "GET") {
      if (href.includes("/creator_briefs")) return { ok: briefsOk, status: briefsOk ? 200 : 500, json: async () => briefs };
      if (href.includes("/creator_asset_versions")) return { ok: versionsOk, status: versionsOk ? 200 : 500, json: async () => versions };
      if (href.includes("/creator_asset_approvals")) return { ok: approvalsOk, status: approvalsOk ? 200 : 500, json: async () => approvals };
      if (href.includes("/creator_assets")) return { ok: assetsOk, status: assetsOk ? 200 : 500, json: async () => assets };
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: writeOk, status: writeOk ? 201 : 500, json: async () => [] };
  };

  registerCreatorProjectGraphRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireWorkspaceAccess: () => (req, res, next) => { req.sonaraUser = { id: USER }; return next(); },
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => (configOk ? { ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" } : { ok: false }),
    supabaseHeaders: () => ({ apikey: "server-only" })
  });
  return { app, calls };
}

const writes = (calls, table) => calls.filter((call) => call.method === "POST" && call.href.includes(`/${table}`));
const patches = (calls, table) => calls.filter((call) => call.method === "PATCH" && call.href.includes(`/${table}`));

describe("an unanswered disclosure is not a no", () => {
  let savedFetch;
  beforeEach(() => { savedFetch = global.fetch; });
  afterEach(() => { global.fetch = savedFetch; });

  describe("the schema it writes to", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");

    it("reads a migration that is actually there", () => {
      // Shape 1: every assertion below is a substring test, and a substring test
      // against an empty string is a check that cannot fail.
      assert.ok(sql.length > 2000, `the project graph migration is ${sql.length} bytes; these assertions have gone blind`);
    });

    it("declares ai_disclosure without NOT NULL and without a default", () => {
      assert.match(sql, /\bai_disclosure boolean,/);
      assert.doesNotMatch(sql, /ai_disclosure boolean[^,]*(not null|default)/i);
    });

    it("hangs an approval off one version rather than off the asset", () => {
      assert.match(sql, /asset_version_id uuid not null references public\.creator_asset_versions\(id\)/);
      assert.doesNotMatch(sql, /asset_version_id uuid not null references public\.creator_assets\(id\)/);
    });

    it("gives every one of the three tables an organization and no delete grant", () => {
      for (const table of ["creator_briefs", "creator_asset_versions", "creator_asset_approvals"]) {
        assert.ok(sql.includes(`create table if not exists public.${table}`), `${table} is not created`);
        assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*${table}`, "i"), `${table} grants DELETE`);
      }
      assert.equal((sql.match(/organization_id uuid not null references public\.organizations\(id\)/g) || []).length, 3);
    });

    it("adds creator_assets.brief_id as a nullable column", () => {
      assert.match(sql, /add column if not exists brief_id uuid references public\.creator_briefs\(id\) on delete set null/);
      assert.doesNotMatch(sql, /brief_id uuid not null/);
    });
  });

  describe("what the three states mean", () => {
    it("reads an absent answer as not recorded, not as a no", () => {
      assert.equal(disclosureOf(version({ aiDisclosure: null })), DISCLOSURE.not_recorded);
      assert.equal(disclosureOf(version({ aiDisclosure: undefined })), DISCLOSURE.not_recorded);
      assert.equal(disclosureOf({}), DISCLOSURE.not_recorded);
      assert.equal(disclosureOf(version({ aiDisclosure: false })), DISCLOSURE.declared_human);
      assert.equal(disclosureOf(version({ aiDisclosure: true })), DISCLOSURE.declared_ai);
      // The three are distinct values, which is the whole point.
      assert.equal(new Set([DISCLOSURE.not_recorded, DISCLOSURE.declared_human, DISCLOSURE.declared_ai]).size, 3);
    });

    it("does not let provenance answer the disclosure question", () => {
      // A file a machine made is not a file somebody declared. Reading one off the
      // other is how a disclosure nobody gave starts reading as one that was.
      const generated = version({ source: "generated", provenance: { generated: true }, aiDisclosure: null });
      assert.equal(madeByMachine(generated), true);
      assert.equal(disclosureOf(generated), DISCLOSURE.not_recorded);
    });

    it("reads an unreadable approval list as unreadable rather than as none", () => {
      const unreadable = approvalStateOf(null);
      assert.equal(unreadable.ok, false);
      assert.equal(unreadable.state, null);
      const none = approvalStateOf([]);
      assert.equal(none.ok, true);
      assert.equal(none.state, "none");
    });
  });

  describe("whether it may go out", () => {
    it("refuses a machine-made version whose disclosure nobody recorded", () => {
      const readiness = publishReadiness(version({ source: "generated", aiDisclosure: null }), [approval()]);
      assert.equal(readiness.ok, false);
      assert.deepEqual(readiness.blockers.map((blocker) => blocker.id), ["disclosure_not_recorded"]);
    });

    it("allows the same version once the question is answered either way", () => {
      for (const answer of [true, false]) {
        const readiness = publishReadiness(version({ source: "generated", aiDisclosure: answer }), [approval()]);
        assert.equal(readiness.ok, true, `answering ${answer} should clear it`);
      }
    });

    it("does not ask the disclosure question of a file a person uploaded", () => {
      const readiness = publishReadiness(version({ source: "uploaded", aiDisclosure: null }), [approval()]);
      assert.equal(readiness.ok, true);
      assert.equal(readiness.disclosure, DISCLOSURE.not_recorded);
    });

    it("refuses an unapproved version, and says which of the two reasons applies", () => {
      const never = publishReadiness(version({ source: "uploaded" }), []);
      assert.equal(never.ok, false);
      assert.deepEqual(never.blockers.map((blocker) => blocker.id), ["not_approved"]);

      const rejected = publishReadiness(version({ source: "uploaded" }), [approval({ state: "rejected" })]);
      assert.equal(rejected.ok, false);
      assert.match(rejected.reason, /rejected/);

      // Both at once, so a page cannot fix one and think it is done.
      const both = publishReadiness(version({ source: "generated", aiDisclosure: null }), []);
      assert.deepEqual(both.blockers.map((blocker) => blocker.id).sort(), ["disclosure_not_recorded", "not_approved"]);
    });

    it("lets the latest row win, so a withdrawal or a fresh review request un-clears it", () => {
      const withdrawn = publishReadiness(version({ source: "uploaded" }), [
        approval({ state: "approved", decidedAt: "2026-10-01T10:00:00.000Z" }),
        approval({ id: "ap-2", state: "withdrawn", decidedAt: "2026-10-02T10:00:00.000Z" })
      ]);
      assert.equal(withdrawn.ok, false);

      // Asking for another review after an approval puts the version back under
      // review. The module's comment claimed the opposite until this assertion was
      // written and failed; the comment was corrected, not the behaviour, because
      // somebody asking again is somebody who is no longer sure.
      const asked = publishReadiness(version({ source: "uploaded" }), [
        approval({ state: "approved", decidedAt: "2026-10-01T10:00:00.000Z" }),
        approval({ id: "ap-2", state: "review_requested", decidedAt: null, createdAt: "2026-10-02T10:00:00.000Z" })
      ]);
      assert.equal(asked.ok, false);
      assert.equal(asked.approval, "review_requested");

      // And the ordinary flow is untouched: the request that preceded the approval
      // still loses to it.
      const normal = publishReadiness(version({ source: "uploaded" }), [
        approval({ id: "ap-0", state: "review_requested", decidedAt: null, createdAt: "2026-09-30T10:00:00.000Z" }),
        approval({ state: "approved", decidedAt: "2026-10-01T10:00:00.000Z" })
      ]);
      assert.equal(normal.ok, true);
    });

    it("refuses when the approvals could not be read at all", () => {
      const readiness = publishReadiness(version({ source: "uploaded" }), null);
      assert.equal(readiness.ok, false);
      assert.deepEqual(readiness.blockers.map((blocker) => blocker.id), ["approval_unreadable"]);
    });

    it("keeps an approval on the version it was given on", () => {
      // The decision on v1 says nothing about v2. If approvals keyed on the asset
      // this assertion would be impossible to write, which is why it is here.
      const v1 = version({ id: "v-1", versionNumber: 1, source: "uploaded" });
      const v2 = version({ id: "v-2", versionNumber: 2, source: "uploaded" });
      const byVersion = { "v-1": [approval({ versionId: "v-1" })] };
      assert.equal(publishReadiness(v1, byVersion["v-1"]).ok, true);
      assert.equal(publishReadiness(v2, byVersion["v-2"] || []).ok, false);
    });
  });

  describe("numbering a version", () => {
    it("refuses to guess when the list could not be read", () => {
      assert.equal(nextVersionNumber(null).ok, false);
      assert.equal(nextVersionNumber(undefined).ok, false);
    });

    it("starts at one and steps from the highest, not from the count", () => {
      assert.equal(nextVersionNumber([]).next, 1);
      // A deleted middle version must not make the next one collide.
      assert.equal(nextVersionNumber([{ versionNumber: 1 }, { versionNumber: 7 }]).next, 8);
    });
  });

  describe("the graph for a brief", () => {
    it("reports an asset whose versions could not be read as unreadable", () => {
      // The caller says the read failed. This asserted the same thing with an empty
      // map until 2 October 2026, which encoded a conflation: a failed read and an
      // asset with no versions both produce a missing key, and the module guessed
      // the alarming one, so the page told a creator their versions could not be
      // read when the asset simply had none.
      const assembled = graphForBrief({
        brief: { id: BRIEF, title: "Autumn single" },
        assets: [{ id: ASSET, title: "Cover art" }],
        versionsByAsset: {},
        approvalsByVersion: {},
        versionsReadable: false
      });
      assert.equal(assembled.ok, true);
      assert.equal(assembled.unreadable, 1);
      assert.equal(assembled.publishable, 0);
      assert.equal(assembled.nodes[0].readiness, null);
    });

    it("reports an asset with no versions as having none, not as unreadable", () => {
      const assembled = graphForBrief({
        brief: { id: BRIEF, title: "Autumn single" },
        assets: [{ id: ASSET, title: "Cover art" }],
        versionsByAsset: {},
        approvalsByVersion: {}
      });
      assert.equal(assembled.ok, true);
      assert.equal(assembled.unreadable, 0, "an asset with no versions was reported as unreadable");
      assert.equal(assembled.nodes[0].versions.length, 0);
      assert.equal(assembled.nodes[0].latest, null);
    });

    it("takes the newest version by number rather than by list order", () => {
      const assembled = graphForBrief({
        brief: { id: BRIEF },
        assets: [{ id: ASSET }],
        versionsByAsset: { [ASSET]: [version({ id: "v-1", versionNumber: 1 }), version({ id: "v-3", versionNumber: 3 }), version({ id: "v-2", versionNumber: 2 })] },
        approvalsByVersion: { "v-3": [approval({ versionId: "v-3" })] }
      });
      assert.equal(assembled.nodes[0].latest.id, "v-3");
      assert.equal(assembled.publishable, 1);
    });

    it("refuses a brief it was not given", () => {
      assert.equal(graphForBrief({ brief: null, assets: [] }).ok, false);
      assert.equal(graphForBrief({ brief: { id: BRIEF }, assets: null }).ok, false);
    });
  });

  describe("reading a form", () => {
    it("names every problem it can report", () => {
      const codes = ["title_missing", "title_long", "intent_unknown", "status_unknown", "asset_missing", "version_missing", "source_unknown", "note_long", "nothing_to_decide"];
      for (const code of codes) assert.equal(typeof problemSentence(code), "string", `${code} has no sentence`);
      assert.equal(problemSentence("not_a_code"), null);
    });

    it("refuses a brief with no title and one that is too long", () => {
      assert.deepEqual(normalizeBrief({ title: "  " }).problems, ["title_missing"]);
      assert.deepEqual(normalizeBrief({ title: "x".repeat(TITLE_MAX + 1) }).problems, ["title_long"]);
      assert.equal(normalizeBrief({ title: "x".repeat(TITLE_MAX) }).ok, true);
    });

    it("refuses an intent or status outside the schema's own check constraints", () => {
      const sql = fs.readFileSync(MIGRATION, "utf8");
      for (const intent of BRIEF_INTENTS) assert.ok(sql.includes(`'${intent}'`), `the migration does not allow intent ${intent}`);
      for (const status of BRIEF_STATUSES) assert.ok(sql.includes(`'${status}'`), `the migration does not allow status ${status}`);
      for (const source of VERSION_SOURCES) assert.ok(sql.includes(`'${source}'`), `the migration does not allow source ${source}`);
      for (const state of APPROVAL_STATES) assert.ok(sql.includes(`'${state}'`), `the migration does not allow approval state ${state}`);
      assert.deepEqual(normalizeBrief({ title: "Ok", intent: "vibes" }).problems, ["intent_unknown"]);
      assert.deepEqual(normalizeBrief({ title: "Ok", status: "shipped" }).problems, ["status_unknown"]);
    });

    it("defaults an unsupplied intent and status rather than refusing", () => {
      const normalized = normalizeBrief({ title: "Ok" });
      assert.equal(normalized.ok, true);
      assert.equal(normalized.brief.intent, "original");
      assert.equal(normalized.brief.status, "open");
      assert.equal(normalized.brief.summary, null);
    });

    it("keeps every machine source inside the set of sources a version may have", () => {
      for (const source of MACHINE_SOURCES) assert.ok(VERSION_SOURCES.includes(source), `${source} is not a version source`);
      assert.ok(MACHINE_SOURCES.length >= 1);
    });
  });

  describe("the page", () => {
    it("renders a brief and whether its newest version may go out", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 200);
      assert.match(response.text, /Autumn single/);
      // Generated, approved, no disclosure -- so it must NOT read as ready.
      assert.doesNotMatch(response.text, /ready to publish/);
      assert.match(response.text, /disclosed as AI-generated/);
    });

    it("says ready once the disclosure is recorded", async () => {
      const { app } = buildApp({
        versions: [{ id: VERSION, asset_id: ASSET, version_number: 1, source: "generated", ai_disclosure: true, provenance: null, note: null, created_at: "2026-09-02T00:00:00.000Z" }]
      });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /ready to publish/);
    });

    it("scopes every read to the organization", async () => {
      const { app, calls } = buildApp();
      await request(app).get(PAGE);
      const reads = calls.filter((call) => call.method === "GET");
      assert.ok(reads.length >= 4, `only ${reads.length} reads; this assertion has gone blind`);
      for (const read of reads) assert.ok(read.href.includes(`organization_id=eq.${ORG}`), `unscoped read: ${read.href}`);
    });

    it("tells the customer a read failed rather than that they have nothing", async () => {
      for (const failure of [{ briefsOk: false }, { assetsOk: false }, { versionsOk: false }, { approvalsOk: false }]) {
        const { app } = buildApp(failure);
        const response = await request(app).get(PAGE);
        assert.equal(response.status, 200);
        assert.match(response.text, /could not read part of your project graph/, `${Object.keys(failure)[0]} rendered as an empty page`);
        assert.doesNotMatch(response.text, /No briefs yet/);
      }
    });

    it("says no briefs yet only when the read succeeded and was empty", async () => {
      const { app } = buildApp({ briefs: [], assets: [], versions: [], approvals: [] });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /No briefs yet/);
    });

    it("shows assets that belong to no brief rather than hiding them", async () => {
      const { app } = buildApp({ assets: [{ id: ASSET, title: "Old cover", asset_type: "image", status: "draft", brief_id: null }] });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /Not attached to a brief/);
    });

    it("refuses to render anything when the workspace cannot be resolved", async () => {
      for (const broken of [{ organization: null }, { configOk: false }]) {
        const { app, calls } = buildApp(broken);
        const response = await request(app).get(PAGE);
        assert.equal(response.status, 503);
        assert.equal(calls.filter((call) => call.method === "GET").length, 0, "it read the database without a workspace");
      }
    });
  });

  describe("the forms on it", () => {
    // Every POST this file registers has to be reachable from the page.
    // tests/form-reachability.test.js checks that nothing is unaccounted for;
    // these check that the forms it finds are the right ones, with the choices the
    // schema actually allows.
    it("offers a form for every endpoint it registers", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      const endpoints = [
        "/api/creator/briefs",
        "/api/creator/briefs/status",
        "/api/creator/assets/versions",
        "/api/creator/assets/versions/disclose",
        "/api/creator/assets/versions/review",
        "/api/creator/assets/versions/decide"
      ];
      for (const endpoint of endpoints) {
        assert.ok(response.text.includes(`action="${endpoint}"`), `no form posts to ${endpoint}`);
      }
      assert.equal(endpoints.length, 6, "a route was added without a form assertion");
    });

    it("offers only the intents, statuses and sources the schema allows", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      for (const intent of BRIEF_INTENTS) assert.ok(response.text.includes(`value="${intent}"`), `the brief form omits intent ${intent}`);
      for (const status of BRIEF_STATUSES) assert.ok(response.text.includes(`value="${status}"`), `the status form omits ${status}`);
      for (const source of VERSION_SOURCES) assert.ok(response.text.includes(`value="${source}"`), `the version form omits source ${source}`);
      // And nothing the schema would refuse.
      assert.doesNotMatch(response.text, /value="shipped"/);
    });

    it("offers a third disclosure answer, so a creator is not forced to claim one", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      // The version form's three radios: yes, no, and "I will answer this later".
      assert.match(response.text, /name="ai_disclosure" value="true"/);
      assert.match(response.text, /name="ai_disclosure" value="false"/);
      assert.match(response.text, /name="ai_disclosure" value="" checked/);
      assert.match(response.text, /answer this later/);
    });

    it("shows the disclosure form only on a version that needs one", async () => {
      // Generated, approved, unanswered -- the form must be there.
      const needs = await request(buildApp().app).get(PAGE);
      assert.ok(needs.text.includes('action="/api/creator/assets/versions/disclose"'));

      // Answered -- there is nothing left to ask, so no form for it.
      const answered = await request(buildApp({
        versions: [{ id: VERSION, asset_id: ASSET, version_number: 1, source: "generated", ai_disclosure: true, provenance: null, note: null, created_at: "2026-09-02T00:00:00.000Z" }]
      }).app).get(PAGE);
      assert.ok(!answered.text.includes('action="/api/creator/assets/versions/disclose"'), "it offered to answer a question already answered");
    });

    it("offers the brief form even with nothing to read, and no decision form with no version", async () => {
      const { app } = buildApp({ briefs: [], assets: [], versions: [], approvals: [] });
      const response = await request(app).get(PAGE);
      assert.ok(response.text.includes('action="/api/creator/briefs"'), "a creator with nothing cannot open a brief");
      assert.ok(!response.text.includes('action="/api/creator/assets/versions/decide"'), "it offered a decision on nothing");
    });

    it("looks a notice up from its code rather than printing the query string", async () => {
      const { app } = buildApp();
      const saved = await request(app).get(`${PAGE}?done=brief`);
      assert.match(saved.text, /Your brief is open/);

      const problem = await request(app).get(`${PAGE}?problem=save_failed`);
      assert.match(problem.text, /did not save/);

      // An unrecognised code produces no sentence at all, rather than being echoed.
      const crafted = await request(app).get(`${PAGE}?problem=${encodeURIComponent("Your account has been suspended, call this number")}`);
      assert.ok(!crafted.text.includes("call this number"), "a query string reached the page in this product's voice");
      assert.ok(!crafted.text.includes("What just happened"), "an unknown code produced a notice card");
    });
  });

  describe("writing to it", () => {
    it("opens a brief scoped to the organization and the person who asked", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/creator/briefs").send({ title: "Winter EP", intent: "original" });
      assert.equal(response.status, 303);
      assert.match(response.headers.location, /done=brief/);
      const written = writes(calls, "creator_briefs");
      assert.equal(written.length, 1);
      assert.equal(written[0].body.organization_id, ORG);
      assert.equal(written[0].body.created_by, USER);
      assert.equal(written[0].body.title, "Winter EP");
    });

    it("refuses a brief with no title and writes nothing", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/creator/briefs").send({ title: "" });
      assert.match(response.headers.location, /problem=title_missing/);
      assert.equal(writes(calls, "creator_briefs").length, 0);
    });

    it("sends a code through the URL and never a sentence", async () => {
      const { app } = buildApp();
      const response = await request(app).post("/api/creator/briefs").send({ title: "Ok", intent: "vibes" });
      const location = response.headers.location;
      assert.match(location, /problem=intent_unknown/);
      // The sentence is looked up on the page from the code. A sentence in the
      // query string is text a crafted link can put in this product's own voice.
      assert.ok(!location.includes("That is not an intent"), `a sentence round-tripped: ${location}`);
    });

    it("writes an absent disclosure answer as null, not as false", async () => {
      const { app, calls } = buildApp({ versions: [] });
      await request(app).post("/api/creator/assets/versions").send({ asset_id: ASSET, source: "generated" });
      const written = writes(calls, "creator_asset_versions");
      assert.equal(written.length, 1);
      assert.equal(written[0].body.ai_disclosure, null);
      assert.notEqual(written[0].body.ai_disclosure, false);
      assert.equal(written[0].body.version_number, 1);
    });

    it("writes the answer the person actually gave", async () => {
      for (const [sent, expected] of [["true", true], ["false", false]]) {
        const { app, calls } = buildApp({ versions: [] });
        await request(app).post("/api/creator/assets/versions").send({ asset_id: ASSET, source: "generated", ai_disclosure: sent });
        assert.equal(writes(calls, "creator_asset_versions")[0].body.ai_disclosure, expected);
      }
    });

    it("numbers the next version from the highest already recorded", async () => {
      const { app, calls } = buildApp({ versions: [{ version_number: 4 }, { version_number: 2 }] });
      await request(app).post("/api/creator/assets/versions").send({ asset_id: ASSET, source: "uploaded" });
      assert.equal(writes(calls, "creator_asset_versions")[0].body.version_number, 5);
    });

    it("refuses a version on an asset that is not this organization's", async () => {
      const { app, calls } = buildApp({ assets: [] });
      const response = await request(app).post("/api/creator/assets/versions").send({ asset_id: ASSET, source: "uploaded" });
      assert.match(response.headers.location, /problem=asset_missing/);
      assert.equal(writes(calls, "creator_asset_versions").length, 0);
    });

    it("refuses a source the schema would reject, before writing", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/creator/assets/versions").send({ asset_id: ASSET, source: "conjured" });
      assert.match(response.headers.location, /problem=source_unknown/);
      assert.equal(calls.length, 0, "it talked to the database about an invalid source");
    });

    it("records a decision as a new row rather than editing the request", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/creator/assets/versions/decide").send({ version_id: VERSION, state: "approved" });
      assert.equal(writes(calls, "creator_asset_approvals").length, 1);
      assert.equal(patches(calls, "creator_asset_approvals").length, 0, "it overwrote the review request");
      const body = writes(calls, "creator_asset_approvals")[0].body;
      assert.equal(body.asset_version_id, VERSION);
      assert.equal(body.state, "approved");
      assert.equal(body.decided_by, USER);
      assert.equal(body.organization_id, ORG);
    });

    it("refuses a decision on a version that is not this organization's", async () => {
      const { app, calls } = buildApp({ versions: [] });
      const response = await request(app).post("/api/creator/assets/versions/decide").send({ version_id: VERSION, state: "approved" });
      assert.match(response.headers.location, /problem=version_missing/);
      assert.equal(writes(calls, "creator_asset_approvals").length, 0);
    });

    it("refuses a decision that is not one of the three", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/creator/assets/versions/decide").send({ version_id: VERSION, state: "approved_probably" });
      assert.match(response.headers.location, /problem=version_missing/);
      assert.equal(calls.length, 0);
    });

    it("carries the organization filter on every write it addresses by id", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/creator/briefs/status").send({ brief_id: BRIEF, status: "delivered" });
      await request(app).post("/api/creator/assets/versions/disclose").send({ version_id: VERSION, ai_disclosure: "true" });
      const byId = calls.filter((call) => call.method === "PATCH");
      assert.ok(byId.length >= 2, `only ${byId.length} id-addressed writes; this assertion has gone blind`);
      for (const call of byId) {
        assert.ok(call.href.includes(`organization_id=eq.${ORG}`), `an id alone authorised a write: ${call.href}`);
      }
    });

    it("refuses a disclosure answer that is neither yes nor no", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/creator/assets/versions/disclose").send({ version_id: VERSION, ai_disclosure: "maybe" });
      assert.match(response.headers.location, /problem=version_missing/);
      assert.equal(calls.length, 0);
    });

    it("truncates an over-long note rather than letting PostgREST refuse the row", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/creator/assets/versions/decide")
        .send({ version_id: VERSION, state: "approved", note: "x".repeat(NOTE_MAX + 500) });
      const note = writes(calls, "creator_asset_approvals")[0].body.note;
      assert.equal(note.length, NOTE_MAX);
      // And the brief form refuses rather than truncating, because a summary
      // silently cut in half is a sentence the creator did not write.
      assert.deepEqual(normalizeBrief({ title: "Ok", summary: "y".repeat(NOTE_MAX + 1) }).problems, ["note_long"]);
    });

    it("reports a failed write as a failed write", async () => {
      const { app } = buildApp({ writeOk: false });
      const response = await request(app).post("/api/creator/briefs").send({ title: "Winter EP" });
      assert.match(response.headers.location, /problem=save_failed/);
    });

    it("refuses every write when the workspace cannot be resolved", async () => {
      const posts = [
        ["/api/creator/briefs", { title: "Winter EP" }],
        ["/api/creator/briefs/status", { brief_id: BRIEF, status: "open" }],
        ["/api/creator/assets/versions", { asset_id: ASSET, source: "uploaded" }],
        ["/api/creator/assets/versions/disclose", { version_id: VERSION, ai_disclosure: "true" }],
        ["/api/creator/assets/versions/review", { version_id: VERSION }],
        ["/api/creator/assets/versions/decide", { version_id: VERSION, state: "approved" }]
      ];
      assert.equal(posts.length, 6, "a route was added without being covered here");
      for (const [route, body] of posts) {
        const { app, calls } = buildApp({ organization: null });
        const response = await request(app).post(route).send(body);
        assert.equal(response.status, 303, route);
        assert.match(response.headers.location, /problem=workspace/, route);
        assert.equal(calls.length, 0, `${route} touched the database with no workspace`);
      }
    });
  });

  describe("a row id cannot become a property name", () => {
    // `groupBy` builds `out[id] = out[id] || []`, which is a dynamic property write.
    // The storefront had the same shape taking its key from a form field name, and
    // CodeQL raised that one as remote property injection on 2 October 2026.
    //
    // This one is not reached from a request -- asset_id and asset_version_id are
    // `uuid not null` in the migration, so PostgreSQL refuses anything else. The
    // guard is still there, because a reason that lives in a column type two files
    // away is not visible from this one, and this test is why the guard is not
    // simply trusted: without it, `out["__proto__"]` reads Object.prototype and
    // `.push` on it throws, so a malformed row takes the page down.
    it("ignores a row whose id is not a uuid, rather than throwing on it", async () => {
      const { app } = buildApp({
        versions: [
          { id: VERSION, asset_id: "__proto__", version_number: 1, source: "uploaded", ai_disclosure: null, provenance: null, note: null },
          { id: "e6e6e6e6-0000-4000-8000-00000000006e", asset_id: "constructor", version_number: 1, source: "uploaded", ai_disclosure: null, provenance: null, note: null }
        ]
      });
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 200, "a row with a non-uuid id took the page down");
      // The real asset has no usable version, and says so, rather than being handed
      // a group assembled from a prototype.
      assert.match(response.text, /no version recorded yet/);
    });

    it("still groups real uuids", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 200);
      // The ordinary path: a version whose asset_id is a real uuid is attached, so
      // the guard above is not passing by rejecting everything.
      assert.match(response.text, /v1:/);
      assert.doesNotMatch(response.text, /no version recorded yet/);
    });
  });

  describe("it is reachable", () => {
    it("is registered in server.js, so its tables are not orphans", () => {
      const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
      assert.ok(server.includes("sonara-creator-project-graph-routes.cjs"), "server.js does not require the project graph routes");
      assert.match(server, /registerCreatorProjectGraphRoutes\(app,/, "server.js requires the module but never calls it");
    });

    it("refuses to register without every dependency it uses", () => {
      const required = ["layout", "brandCard", "linkAction", "escapeHtml", "requireWorkspaceAccess", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders"];
      for (const missing of required) {
        const deps = Object.fromEntries(required.filter((name) => name !== missing).map((name) => [name, () => {}]));
        assert.throws(() => registerCreatorProjectGraphRoutes(express(), deps), new RegExp(missing), `registering without ${missing} did not throw`);
      }
    });
  });
});
