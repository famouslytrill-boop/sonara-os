"use strict";

// A stage gate that can be read on a page and not passed from it is a gate the
// customer cannot pass.
//
// `/product-lifecycle/initiatives/:id` showed the readiness score, listed what
// was missing, and offered forms for evidence, requirements, feedback and the
// review. Three of the seven stages could not be passed from it:
//
//   plan   needs a target for the primary metric. The create form never asked
//          for one and nothing could edit the initiative afterwards.
//   build  needs an iteration with a Definition of Done that is active or done.
//          There was no iteration form, and nothing could move one along.
//   beta, launch, learn & scale
//          are blocked by any open critical finding, and nothing could close
//          one. One critical finding blocked the initiative for good.
//
// Each test below drives only the page's own forms, the way a person would, and
// ends with the review that advances the stage. The fourth is the other half:
// a feedback read that failed was graded as "no feedback", which made "no
// unresolved critical feedback" true and lifted the blocker.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/product-lifecycle-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const INITIATIVE = "33333333-3333-4333-8333-333333333333";
const PAGE = `/product-lifecycle/initiatives/${INITIATIVE}`;

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function buildApp(fake) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authorize = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: escape,
    requireCustomer: authorize,
    requireWorkspaceAccess: () => authorize,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" })
  });
  return app;
}

function initiative(stage, fields = {}) {
  return {
    id: INITIATIVE,
    organization_id: ORG,
    studio_key: "business_builder",
    name: "Same-day enquiry replies",
    lifecycle_stage: stage,
    status: "active",
    problem_statement: "Independent caterers lose bookings when enquiries wait more than a day for a reply.",
    target_audience: "Independent caterers with fewer than ten staff.",
    value_proposition: "Every enquiry answered the same day without a sales team.",
    product_goal: "Fifty caterers answer every enquiry the same day.",
    primary_metric: "same-day replies",
    target_metric: 50,
    target_launch_date: null,
    created_at: "2026-10-01T00:00:00Z",
    ...fields
  };
}

const child = (fields) => ({ id: crypto.randomUUID(), organization_id: ORG, initiative_id: INITIATIVE, created_at: "2026-10-02T00:00:00Z", ...fields });
const evidence = (type) => child({ evidence_type: type, source: "Owner interviews", summary: `${type} evidence`, confidence: "high" });

function form(app, url, fields) {
  return request(app).post(url).type("form").set("accept", "text/html").send(fields);
}

async function readiness(app) {
  const page = await request(app).get(PAGE).set("accept", "text/html");
  assert.equal(page.status, 200, `the initiative page answered ${page.status}, so nothing on it was checked`);
  const score = page.text.match(/Stage readiness: (\d+)\/100/);
  assert.ok(score, "the page no longer shows a readiness score");
  return { page, score: Number(score[1]) };
}

describe("a stage gate can be passed from the page", () => {
  let fake;
  let savedFetch;

  function start(tables) {
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }

  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  const stageOf = () => fake.rows("product_lifecycle_initiatives")[0].lifecycle_stage;

  it("plan: the goal and the metric's target are set on the page, then the review advances", async () => {
    const app = start({
      product_lifecycle_initiatives: [initiative("plan", { product_goal: null, target_metric: null })],
      product_lifecycle_requirements: [
        child({ requirement_type: "user_story", title: "Reply from one inbox", priority: "must" }),
        child({ requirement_type: "non_goal", title: "No CRM", priority: "wont" })
      ]
    });

    const before = await readiness(app);
    assert.ok(before.score < 70, `the plan gate already read ${before.score}, so this would prove nothing`);
    const refused = await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "Scope is agreed." });
    assert.equal(refused.status, 409, "an under-threshold advance was accepted");

    assert.ok(before.page.text.includes(`action="${PAGE}"`), "the page has no form for editing the initiative");
    assert.match(before.page.text, /name="target_metric"/, "nothing on the page asks for the metric's target, which the plan gate needs");

    const saved = await form(app, PAGE, {
      name: "Same-day enquiry replies",
      product_goal: "Fifty caterers answer every enquiry the same day.",
      primary_metric: "same-day replies",
      target_metric: "50"
    });
    assert.equal(saved.status, 303, `saving the initiative answered ${saved.status}`);
    assert.equal(saved.headers.location, PAGE);
    const row = fake.rows("product_lifecycle_initiatives")[0];
    assert.equal(Number(row.target_metric), 50, "the target the page form sent was not saved");
    assert.ok(row.product_goal, "the Product Goal the page form sent was not saved");

    const after = await readiness(app);
    assert.ok(after.score >= 70, `the plan gate still reads ${after.score} after the page's own form filled it`);
    const advanced = await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "Goal, scope and target are set.", approved: "true" });
    assert.equal(advanced.status, 303, `the advance answered ${advanced.status}`);
    assert.equal(stageOf(), "build");
  });

  it("build: an iteration is planned on the page and moved to active there", async () => {
    const app = start({
      product_lifecycle_initiatives: [initiative("build")],
      product_lifecycle_evidence: [evidence("security")]
    });

    const before = await readiness(app);
    assert.ok(before.page.text.includes(`action="${PAGE}/iterations"`), "the page has no form for adding an iteration, which the build gate needs");

    const planned = await form(app, `${PAGE}/iterations`, {
      iteration_number: "1",
      goal: "One reply queue for every enquiry channel.",
      status: "planned",
      definition_of_done: "Tests pass, the queue is keyboard-usable, and the reply path is traced."
    });
    assert.equal(planned.status, 303, `adding the iteration answered ${planned.status}`);
    const iteration = fake.rows("product_lifecycle_iterations")[0];
    assert.ok(iteration, "no iteration was saved");
    assert.equal(iteration.status, "planned");

    const stillPlanned = await readiness(app);
    assert.ok(stillPlanned.score < 70, `a planned iteration already passes the build gate (${stillPlanned.score}), so the status control would prove nothing`);
    assert.equal((await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "Underway." })).status, 409);

    const control = `action="${PAGE}/iterations/${iteration.id}/status"`;
    assert.ok(stillPlanned.page.text.includes(control), "the page lists the iteration with no way to move it along");
    const moved = await form(app, `${PAGE}/iterations/${iteration.id}/status`, { status: "active" });
    assert.equal(moved.status, 303, `moving the iteration answered ${moved.status}`);
    assert.equal(fake.rows("product_lifecycle_iterations")[0].status, "active");

    const after = await readiness(app);
    assert.ok(after.score >= 70, `the build gate reads ${after.score} with an active iteration and a Definition of Done`);
    assert.equal((await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "First increment is live behind a flag.", approved: "true" })).status, 303);
    assert.equal(stageOf(), "beta");
  });

  it("beta: a critical finding is closed on the page, with a note, before the review advances", async () => {
    const critical = child({ category: "performance", severity: "critical", summary: "The queue takes 9 seconds to load.", status: "new" });
    const app = start({
      product_lifecycle_initiatives: [initiative("beta")],
      product_lifecycle_feedback: [
        child({ category: "usability", severity: "low", summary: "Reply button is small.", status: "resolved" }),
        child({ category: "functionality", severity: "medium", summary: "Attachments missing.", status: "new" }),
        critical
      ]
    });

    const blocked = await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "Feedback is in." });
    assert.equal(blocked.status, 409, "an open critical finding did not block the advance");
    assert.match(blocked.text, /critical/i);

    const { page } = await readiness(app);
    const action = `${PAGE}/feedback/${critical.id}/status`;
    assert.ok(page.text.includes(`action="${action}"`), "the page lists the critical finding with no way to close it");

    const unexplained = await form(app, action, { status: "resolved" });
    assert.equal(unexplained.status, 400, `closing a critical finding with no note answered ${unexplained.status}; it must be refused, because the note is the only record of how it was dealt with`);
    assert.equal(fake.rows("product_lifecycle_feedback").find((row) => row.id === critical.id).status, "new");

    const closed = await form(app, action, { status: "resolved", note: "Paginated the queue; loads in 400 ms on a mid-range phone." });
    assert.equal(closed.status, 303, `closing the finding answered ${closed.status}`);
    const row = fake.rows("product_lifecycle_feedback").find((entry) => entry.id === critical.id);
    assert.equal(row.status, "resolved");
    assert.match(String(row.metadata?.status_note || ""), /Paginated/);

    assert.equal((await form(app, `${PAGE}/reviews`, { decision: "advance", rationale: "Critical finding fixed and verified.", approved: "true" })).status, 303);
    assert.equal(stageOf(), "launch");
  });

  it("does not grade a feedback read that failed as no feedback, so the blocker stays", async () => {
    const app = start({
      product_lifecycle_initiatives: [initiative("launch")],
      product_lifecycle_evidence: ["pricing", "support", "regulatory", "security", "analytics"].map(evidence),
      product_lifecycle_feedback: [child({ category: "security", severity: "critical", summary: "Session survives logout.", status: "new" })]
    });

    // The control: read normally, the open finding blocks the launch.
    const blocked = await request(app).post(`/api/product-lifecycle/initiatives/${INITIATIVE}/reviews`).send({ decision: "advance", rationale: "Ready." });
    assert.equal(blocked.status, 409, `the control did not block (${blocked.status}), so the failed-read case below would prove nothing`);
    assert.equal(blocked.body.code, "stage_gate_blocked");

    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      const url = String(typeof input === "string" ? input : input?.url);
      if (url.includes("/rest/v1/product_lifecycle_feedback") && String(init.method || "GET").toUpperCase() === "GET") {
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({ message: "boom" }) };
      }
      return installed(input, init);
    };
    const review = await request(app).post(`/api/product-lifecycle/initiatives/${INITIATIVE}/reviews`).send({ decision: "advance", rationale: "Ready." });
    assert.notEqual(review.status, 201, "the launch advanced while its feedback could not be read, past an open critical finding");
    assert.equal(review.body.code, "initiative_records_unreadable");
    assert.deepEqual(review.body.unreadable, ["feedback"]);
    assert.equal(stageOf(), "launch");
    assert.equal(fake.rows("product_lifecycle_stage_reviews").length, 0, "a review was recorded on an ungraded gate");

    const page = await request(app).get(PAGE).set("accept", "text/html");
    assert.equal(page.status, 502);
    assert.match(page.text, /feedback could not be read/);
  });

  it("moves the stage through a review and nowhere else", async () => {
    const app = start({ product_lifecycle_initiatives: [initiative("discover")] });

    const skipped = await request(app).patch(`/api/product-lifecycle/initiatives/${INITIATIVE}`).send({ lifecycle_stage: "launch" });
    assert.equal(skipped.status, 400, "the JSON PATCH set the stage directly, skipping every gate");
    assert.equal(skipped.body.code, "stage_moves_by_review", "a stage sent to the PATCH was dropped silently rather than refused, so the caller is not told why it did not move");
    assert.equal(stageOf(), "discover", "the PATCH moved the stage");

    const scaled = await request(app).patch(`/api/product-lifecycle/initiatives/${INITIATIVE}`).send({ status: "scaled" });
    assert.equal(scaled.status, 400, "the JSON PATCH recorded a scale decision without the review that grades it");
    assert.equal(scaled.body.code, "status_set_by_review", "a decision status sent to the PATCH was not refused by name");

    // The page form carries only the editable fields, so a crafted field is
    // dropped rather than trusted.
    const crafted = await form(app, PAGE, { name: "Same-day enquiry replies", lifecycle_stage: "launch", status: "scaled" });
    assert.equal(crafted.status, 303);
    assert.equal(stageOf(), "discover");
    assert.equal(fake.rows("product_lifecycle_initiatives")[0].status, "active");

    const renamed = await request(app).patch(`/api/product-lifecycle/initiatives/${INITIATIVE}`).send({ primary_metric: "replies within four hours" });
    assert.equal(renamed.status, 200, "an ordinary edit through the PATCH stopped working");
    assert.equal(fake.rows("product_lifecycle_initiatives")[0].primary_metric, "replies within four hours");
  });

  it("offers on the page every initiative field a gate reads, and nothing that moves the stage", async () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "product-lifecycle-routes.cjs"), "utf8");
    const start_ = source.indexOf("function scoreInitiative(");
    const end = source.indexOf("\n}\n", start_);
    assert.ok(start_ > 0 && end > start_, "scoreInitiative is no longer where this test reads it");
    const graded = new Set([...source.slice(start_, end).matchAll(/\binitiative\.([a-z_]+)/g)].map((match) => match[1]));
    graded.delete("lifecycle_stage");
    assert.ok(graded.size >= 5, `only ${graded.size} initiative fields found in scoreInitiative; this check has gone blind`);

    const { EDITABLE_FIELDS } = registerRoutes;
    for (const field of graded) assert.ok(EDITABLE_FIELDS.includes(field), `the gates read initiative.${field} and the page cannot edit it`);
    assert.ok(!EDITABLE_FIELDS.includes("lifecycle_stage"), "the stage became an editable field");
    assert.ok(!EDITABLE_FIELDS.includes("status"), "the decision-owned status became an editable field");

    const app = start({ product_lifecycle_initiatives: [initiative("plan")] });
    const { page } = await readiness(app);
    for (const field of EDITABLE_FIELDS) assert.match(page.text, new RegExp(`name="${field}"`), `the edit form has no ${field}`);
  });

  it("says when the initiatives could not be read rather than listing none", async () => {
    const app = start({ product_lifecycle_initiatives: [] });
    const empty = await request(app).get("/product-lifecycle").set("accept", "text/html");
    assert.equal(empty.status, 200);
    assert.match(empty.text, /None yet/);

    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/product_lifecycle_initiatives")) {
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      }
      return installed(input, init);
    };
    const failed = await request(app).get("/product-lifecycle").set("accept", "text/html");
    assert.equal(failed.status, 200);
    assert.match(failed.text, /could not read your initiatives/);
    assert.doesNotMatch(failed.text, /None yet/, "a failed read was reported as having no initiatives");
  });
});
