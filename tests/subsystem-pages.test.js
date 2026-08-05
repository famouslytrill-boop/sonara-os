"use strict";

// The five subsystems that existed as schema and had no code.
//
// Fifty-one tables were created with row level security and indexes, and nothing
// in the application ever read or wrote one of them. /research-lab/subsystems
// makes them readable. What this file checks is mostly what those pages must
// *not* do, because the risks here are all of that shape:
//
//   they must not offer to write. The data model for these subsystems was
//     decided and the behaviour was not, so a form would invent the process.
//     For the agent tables it would also break a guarantee
//     scripts/verify-supabase-contract.mjs asserts on every release -- that the
//     foundation stays schema-only with autonomous execution disabled.
//
//   they must not be reachable by a customer. These tables carry no tenant
//     filter, so there is no version of them that is safe to open without
//     admin.
//
//   they must not render a secret. Columns are derived from the schema rather
//     than listed by hand, which is what keeps them in step with the migrations
//     -- and also means a new column appears on a page the moment somebody adds
//     it, without anybody choosing to show it.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  SUBSYSTEMS,
  RECORDS_A_FACT,
  WITHHELD_COLUMN,
  allSubsystemTables,
  cellText,
  displayColumns,
  formFields,
  isWritable,
  selectFor
} = require("../lib/sonara-subsystem-registry.cjs");
const { describedColumns, tableColumns } = require("../lib/sonara-migration-columns.cjs");

describe("the subsystems that exist as schema only", () => {
  it("covers enough tables to be describing the problem", () => {
    const tables = allSubsystemTables();
    assert.ok(tables.length >= 45, `only ${tables.length} tables covered; this check has gone blind`);
    assert.equal(new Set(tables).size, tables.length, "a table is listed under two subsystems");
  });

  it("names only tables the migrations actually create", () => {
    const missing = allSubsystemTables().filter((table) => !tableColumns(table));
    assert.deepEqual(missing, [], `these are described but no migration creates them:\n  ${missing.join("\n  ")}`);
  });

  it("asks for at least one real column from every table", () => {
    // A table whose columns were all withheld or filtered away would render an
    // empty grid that reads like "no records" rather than "nothing to show".
    const empty = allSubsystemTables().filter((table) => !selectFor(table));
    assert.deepEqual(empty, [], `no columns could be derived for:\n  ${empty.join("\n  ")}`);
  });

  it("selects only columns the table has", () => {
    // The same failure as the record forms: a select naming a column that is
    // not there is rejected, and the page would show "could not be read" for a
    // reason nobody could see.
    const wrong = [];
    for (const table of allSubsystemTables()) {
      const columns = tableColumns(table);
      for (const column of selectFor(table).split(",")) {
        if (!columns.has(column)) wrong.push(`${table}.${column}`);
      }
    }
    assert.deepEqual(wrong, [], `these selects name columns the table does not have:\n  ${wrong.join("\n  ")}`);
  });

  it("never renders a column whose name suggests a secret", () => {
    // Derived columns mean nobody chose these one by one, so the filter is the
    // only thing standing between a credential column and an operator screen.
    const leaked = [];
    for (const table of allSubsystemTables()) {
      for (const column of displayColumns(table)) {
        if (WITHHELD_COLUMN.test(column)) leaked.push(`${table}.${column}`);
      }
    }
    assert.deepEqual(leaked, [], `these would be rendered and look like secrets:\n  ${leaked.join("\n  ")}`);
  });

  it("summarises a json column rather than printing it", () => {
    // Several of these tables hold jsonb -- plan_json, logs_json, config. A blob
    // pasted into a table cell is both unreadable and the most likely way for
    // something private to reach the screen.
    assert.equal(cellText({ a: 1, b: 2 }), "2 fields");
    assert.equal(cellText([1, 2, 3]), "3 items");
    assert.equal(cellText({}), "Empty");
    assert.equal(cellText(null), "Not recorded");
    assert.equal(cellText(""), "Not recorded");
    assert.equal(cellText("x".repeat(300)).length, 120, "a long string is not truncated");
  });

  it("requires admin for every page", async () => {
    // No tenant filter exists for these tables, so a signed-in customer reaching
    // one would see every organization's rows.
    const paths = ["/research-lab/subsystems", ...SUBSYSTEMS.map((subsystem) => `/research-lab/subsystems/${subsystem.slug}`)];
    const open = [];
    for (const path of paths) {
      const res = await request(app).get(path).set("Accept", "text/html").redirects(0);
      // 303 to a login or 503 for unset founder-access credentials both mean the
      // gate ran. A 200 without an admin session does not.
      if (res.status === 200) open.push(`${path} rendered without an admin session`);
    }
    assert.deepEqual(open, [], open.join("\n  "));
  });

  it("refuses a form for anything that records a fact rather than an intention", () => {
    // This replaced a blanket "no writes anywhere" check when the forms were
    // built, and the replacement has to keep teeth rather than becoming a
    // formality. Runs, events, logs, jobs, deployments, memory and approvals
    // stay read-only: typing one in does not make it have happened, and it puts
    // a fabricated row beside real ones with nothing to tell them apart. Same
    // call as growth_touchpoints.
    const readOnly = allSubsystemTables().filter((table) => !isWritable(table));
    assert.ok(readOnly.length >= 10, `only ${readOnly.length} tables are read-only; the rule has gone slack`);
    for (const table of readOnly) {
      assert.deepEqual(formFields(table), [], `${table} records a fact and has been given a form`);
    }
    // And the rule is a rule, not a list somebody has to remember to extend.
    for (const suffix of ["_runs", "_events", "_logs", "_jobs", "_deployments", "_memory", "_approvals"]) {
      assert.match(`anything${suffix}`, RECORDS_A_FACT, `${suffix} is no longer recognised as recording a fact`);
    }
  });

  it("never offers a field for a column the server owns or the database fills in", () => {
    // An id or created_at field would let somebody overwrite what the database
    // generates; an organization_id field on an admin surface would let one row
    // be written into somebody else's tenant.
    const leaked = [];
    for (const table of allSubsystemTables()) {
      for (const field of formFields(table)) {
        if (["id", "organization_id", "user_id", "created_at", "updated_at"].includes(field.name)) leaked.push(`${table}.${field.name}`);
        if (WITHHELD_COLUMN.test(field.name)) leaked.push(`${table}.${field.name} looks like a secret`);
      }
    }
    assert.deepEqual(leaked, [], leaked.join("\n  "));
  });

  it("only offers fields the table actually has", () => {
    // The failure the record forms shipped with: a payload naming a column that
    // is not there is rejected and nothing saves.
    const wrong = [];
    for (const table of allSubsystemTables()) {
      const columns = tableColumns(table);
      for (const field of formFields(table)) {
        if (!columns.has(field.name)) wrong.push(`${table}.${field.name}`);
      }
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("offers a choice wherever the database constrains one", () => {
    // A free-text box on a checked column produces a constraint violation the
    // customer cannot act on. Every field with allowed values must be a choice,
    // and every choice must offer only values the constraint permits.
    const wrong = [];
    for (const table of allSubsystemTables()) {
      const described = new Map(describedColumns(table).map((column) => [column.name, column]));
      for (const field of formFields(table)) {
        const column = described.get(field.name);
        if (!column) continue;
        if (column.allowed.length && field.type !== "choice") wrong.push(`${table}.${field.name} is constrained but rendered free-text`);
        if (field.type === "choice" && field.values.some((value) => !column.allowed.includes(value))) wrong.push(`${table}.${field.name} offers a value the constraint forbids`);
      }
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("writes nothing without an admin session", async () => {
    // The forms are behind the same gate as the pages. Without it, a single
    // POST would write to any of thirty-eight tables across every organization.
    const res = await request(app)
      .post("/api/research-lab/subsystems/sonara_engine_registry")
      .set("Accept", "text/html")
      .type("form")
      .send({ engine_key: "x", name: "x", public_label: "x", description: "x", engine_type: "billing" })
      .redirects(0);
    // requireAdmin redirects to the login page, which is also a 303 -- so the
    // status alone cannot tell a refusal from an acceptance. Where it sends you
    // is what distinguishes them: the handler redirects back to the subsystem
    // page on success, and the gate redirects to /admin/login.
    const target = res.headers.location || "";
    assert.notEqual(res.status, 200, "the write endpoint answered without an admin session");
    assert.doesNotMatch(target, /\/research-lab\/subsystems/, `the write endpoint accepted a submission without an admin session and returned to ${target}`);
    assert.ok(/\/admin\/login/.test(target) || res.status === 503, `expected the admin gate to refuse, got ${res.status} to ${target || "(no redirect)"}`);
  });

  it("says on the page that the agent foundation does not run", () => {
    // Somebody looking at eleven agent tables is entitled to know whether
    // anything is executing. The answer is no, and the release gate keeps it
    // that way -- so the page should say so rather than leaving it inferred.
    const agents = SUBSYSTEMS.find((subsystem) => subsystem.slug === "agent-foundation");
    assert.ok(agents, "the agent subsystem is no longer described");
    assert.match(`${agents.body} ${agents.status}`, /disabled|inert|does not run|nothing.*runs/i);
  });

  it("keeps the agent tables aligned with the group the release gate checks", () => {
    // If a table moves out of DATABASE_TABLE_GROUPS.agentsAndAutomation, the
    // "execution disabled" guarantee stops covering it while this page keeps
    // implying that it does.
    const { DATABASE_TABLE_GROUPS } = require("../lib/sonara-database-contract.cjs");
    const gated = new Set(DATABASE_TABLE_GROUPS.agentsAndAutomation);
    const agents = SUBSYSTEMS.find((subsystem) => subsystem.slug === "agent-foundation");

    // Everything claimed as gated must actually be in the gated group.
    const overclaimed = agents.gatedTables.filter((table) => !gated.has(table));
    assert.deepEqual(overclaimed, [], `claimed as gated but absent from the gated group:\n  ${overclaimed.join("\n  ")}`);

    // And everything on the page is either claimed as gated or declared as not
    // covered -- a table in neither list would be shown with no statement about
    // it at all, which is how the overclaim happened the first time.
    const declared = new Set([...agents.gatedTables, ...agents.ungatedTables]);
    const unaccounted = agents.tables.filter((table) => !declared.has(table));
    assert.deepEqual(unaccounted, [], `shown on the agent page with no statement about gate coverage:\n  ${unaccounted.join("\n  ")}`);

    // If one of the four ever enters the gated group, the page should stop
    // saying it is not covered.
    const nowGated = agents.ungatedTables.filter((table) => gated.has(table));
    assert.deepEqual(nowGated, [], `declared as not covered but now in the gated group:\n  ${nowGated.join("\n  ")}`);
  });
});
