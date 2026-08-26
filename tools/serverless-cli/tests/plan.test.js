"use strict";

// The plan, and the distinction the whole feature rests on.
//
// "Nothing will change" is a claim about the deployed stack. If the lookup
// failed, nothing is known about the deployed stack, and printing the same
// reassuring sentence sends somebody to deploy blind. These two states are
// separate here, and the tests below are mostly about keeping them separate.

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlan } = require("../src/plan.js");

const BASE = { stackName: "orders-api", region: "eu-west-1", exists: true };

test("a failed lookup does not read as nothing to do", () => {
  const plan = buildPlan({ ...BASE, status: "unknown", changes: [] });
  const text = plan.lines.join("\n");
  assert.equal(plan.known, false);
  assert.match(text, /Could not read what would change/);
  assert.match(text, /not the same as nothing changing/);
  assert.ok(!/Nothing to do/.test(text),
    "a failed lookup printed the same reassurance as a genuinely empty change set");
});

test("an empty change set says so, and says it about the stack", () => {
  const plan = buildPlan({ ...BASE, status: "empty", changes: [] });
  assert.equal(plan.known, true);
  assert.match(plan.lines.join("\n"), /already what this file describes/);
});

test("refuses to render without being told which of the two it is", () => {
  assert.throws(() => buildPlan({ ...BASE, changes: [] }), /status of ready, empty or unknown/);
  assert.throws(() => buildPlan({ ...BASE, status: "", changes: [] }), /status/);
});

test("groups creations, updates and deletions and counts them", () => {
  const plan = buildPlan({
    ...BASE,
    status: "ready",
    changes: [
      { Action: "Add", LogicalResourceId: "FnNew", ResourceType: "AWS::Lambda::Function" },
      { Action: "Modify", LogicalResourceId: "FnCheckout", ResourceType: "AWS::Lambda::Function", Replacement: "False" },
      { Action: "Remove", LogicalResourceId: "FnOld", ResourceType: "AWS::Lambda::Function" }
    ]
  });
  assert.deepEqual(plan.counts, { create: 1, update: 1, delete: 1 });
  const text = plan.lines.join("\n");
  assert.match(text, /create:/);
  assert.match(text, /update:/);
  assert.match(text, /delete:/);
  assert.match(text, /1 to create, 1 to update, 1 to delete\./);
});

test("names resources in words rather than in CloudFormation types", () => {
  const plan = buildPlan({
    ...BASE, status: "ready",
    changes: [{ Action: "Add", LogicalResourceId: "TableOrders", ResourceType: "AWS::DynamoDB::Table" }]
  });
  assert.match(plan.lines.join("\n"), /table\s+TableOrders/);
});

test("warns when a table would be replaced, because that is a new empty one", () => {
  const plan = buildPlan({
    ...BASE, status: "ready",
    changes: [{ Action: "Modify", LogicalResourceId: "TableOrders", ResourceType: "AWS::DynamoDB::Table", Replacement: "True" }]
  });
  assert.equal(plan.dangerous, true);
  const text = plan.lines.join("\n");
  assert.match(text, /Careful:/);
  assert.match(text, /TableOrders \(table\) would be replaced, which means a new empty one/);
});

test("warns when a bucket would be deleted", () => {
  const plan = buildPlan({
    ...BASE, status: "ready",
    changes: [{ Action: "Remove", LogicalResourceId: "BucketUploads", ResourceType: "AWS::S3::Bucket" }]
  });
  assert.equal(plan.dangerous, true);
  assert.match(plan.lines.join("\n"), /what is in it goes with it/);
});

test("treats a conditional replacement as worth warning about", () => {
  // "Conditional" means CloudFormation cannot tell. Rendering that as safe is
  // the reading that loses data.
  const plan = buildPlan({
    ...BASE, status: "ready",
    changes: [{ Action: "Modify", LogicalResourceId: "TableOrders", ResourceType: "AWS::DynamoDB::Table", Replacement: "Conditional" }]
  });
  assert.equal(plan.dangerous, true, "a replacement CloudFormation could not rule out was rendered as safe");
});

test("does not warn about replacing a function, which carries nothing", () => {
  const plan = buildPlan({
    ...BASE, status: "ready",
    changes: [{ Action: "Modify", LogicalResourceId: "FnCheckout", ResourceType: "AWS::Lambda::Function", Replacement: "True" }]
  });
  assert.equal(plan.dangerous, false, "replacing a function was reported as dangerous, which trains people to ignore the warning");
});

test("says a stack is being created rather than changed when it does not exist", () => {
  const plan = buildPlan({
    ...BASE, exists: false, status: "ready",
    changes: [{ Action: "Add", LogicalResourceId: "FnCheckout", ResourceType: "AWS::Lambda::Function" }]
  });
  assert.match(plan.lines.join("\n"), /does not exist in eu-west-1 yet\. It would be created/);
});

test("survives a change entry with fields missing rather than rendering undefined", () => {
  const plan = buildPlan({ ...BASE, status: "ready", changes: [{}] });
  const text = plan.lines.join("\n");
  assert.ok(!/undefined/.test(text), "a malformed change rendered the word undefined into the plan");
});
