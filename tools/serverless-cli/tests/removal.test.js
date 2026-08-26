"use strict";

// Deleting, and the three things it has to be honest about.
//
// There is no change set for a delete -- CloudFormation will not tell you in
// advance what DeleteStack destroys -- so this summary is the only warning
// anybody gets, and every way it could be quietly wrong matters.
//
// **Kept is not a footnote.** Tables and buckets survive, by design. A person
// who believes they deleted everything has left a bucket costing money under a
// name this tool will not reuse.
//
// **Unclassified must not fall into "deleted".** A resource type with no rule
// would otherwise be reported as going away when nobody knows that it does.
//
// **An empty list and a failed read are different answers.** "The stack has
// nothing in it" is a reason to go ahead. "We could not look" is not.

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRemoval, RETAINED_TYPES, DELETED_TYPES } = require("../src/removal.js");
const { buildTemplate } = require("../src/template.js");
const { buildApp } = require("../src/manifest.js");
const { parse } = require("../src/yaml.js");

const BASE = { stackName: "orders-api", region: "eu-west-1" };

const RESOURCES = [
  { logicalId: "FnCheckout", physicalId: "orders-api-FnCheckout-ABC", resourceType: "AWS::Lambda::Function" },
  { logicalId: "RoleCheckout", physicalId: "orders-api-RoleCheckout-XYZ", resourceType: "AWS::IAM::Role" },
  { logicalId: "TableOrders", physicalId: "orders-api-TableOrders-DEF", resourceType: "AWS::DynamoDB::Table" },
  { logicalId: "BucketUploads", physicalId: "orders-api-bucketuploads-ghi", resourceType: "AWS::S3::Bucket" },
  { logicalId: "HttpApi", physicalId: "abc123", resourceType: "AWS::ApiGatewayV2::Api" }
];

test("a failed read does not read as an empty stack", () => {
  const removal = buildRemoval({ ...BASE, status: "unknown", resources: [] });
  const text = removal.lines.join("\n");
  assert.equal(removal.known, false);
  assert.match(text, /Could not read what is in/);
  assert.match(text, /not the same as the stack being empty/);
  assert.ok(!/no resources in it/.test(text),
    "a failed read printed the same sentence as a genuinely empty stack, which reads as safe to proceed");
});

test("refuses to render without being told which of the two it is", () => {
  assert.throws(() => buildRemoval({ ...BASE, resources: [] }), /status of ready or unknown/);
  assert.throws(() => buildRemoval({ ...BASE, status: "", resources: [] }), /status/);
});

test("separates what goes from what stays", () => {
  const removal = buildRemoval({ ...BASE, status: "ready", resources: RESOURCES });
  assert.deepEqual(removal.gone.map((entry) => entry.logicalId).sort(), ["FnCheckout", "HttpApi", "RoleCheckout"]);
  assert.deepEqual(removal.kept.map((entry) => entry.logicalId).sort(), ["BucketUploads", "TableOrders"]);
});

test("names kept resources by their real AWS name, because that is what you need to finish by hand", () => {
  const removal = buildRemoval({ ...BASE, status: "ready", resources: RESOURCES });
  const text = removal.lines.join("\n");
  assert.match(text, /orders-api-bucketuploads-ghi/,
    "the kept bucket was named only by its logical id, which is no help in the console");
  assert.match(text, /orders-api-TableOrders-DEF/);
});

test("says out loud that kept resources still exist and still cost money", () => {
  const text = buildRemoval({ ...BASE, status: "ready", resources: RESOURCES }).lines.join("\n");
  assert.match(text, /KEPT/);
  assert.match(text, /still in your account/);
  assert.match(text, /cost money/,
    "a retained bucket was reported as kept without saying it goes on being billed");
});

test("does not invent a kept section when nothing is kept", () => {
  const removal = buildRemoval({
    ...BASE, status: "ready",
    resources: [{ logicalId: "FnA", resourceType: "AWS::Lambda::Function" }]
  });
  assert.equal(removal.kept.length, 0);
  assert.ok(!/KEPT/.test(removal.lines.join("\n")));
});

test("puts a type it has no rule for in its own list rather than in deleted", () => {
  const removal = buildRemoval({
    ...BASE, status: "ready",
    resources: [{ logicalId: "Mystery", resourceType: "AWS::Kinesis::Stream" }]
  });
  assert.equal(removal.gone.length, 0, "an unclassified type was reported as deleted, which nobody had established");
  assert.equal(removal.unknown.length, 1);
  assert.equal(removal.safe, false, "an unclassified resource left the removal marked safe");
  assert.match(removal.lines.join("\n"), /no rule for these/);
});

test("an empty stack is reported as empty, and as safe", () => {
  const removal = buildRemoval({ ...BASE, status: "ready", resources: [] });
  assert.equal(removal.known, true);
  assert.equal(removal.safe, true);
  assert.match(removal.lines.join("\n"), /no resources in it/);
});

test("survives a resource entry with fields missing rather than printing undefined", () => {
  const removal = buildRemoval({ ...BASE, status: "ready", resources: [{}] });
  assert.ok(!/undefined/.test(removal.lines.join("\n")));
});

test("counts what it found", () => {
  const removal = buildRemoval({ ...BASE, status: "ready", resources: RESOURCES });
  assert.match(removal.lines.join("\n"), /3 deleted, 2 kept\./);
});

// This is the assertion that keeps the two files in step. The retained list
// here is a claim about what `template.js` does, and a type that gains a retain
// policy there and not here would be reported as deleted while surviving --
// which is the worst direction for this particular error to run.
test("the retained list matches what the template actually retains", () => {
  const template = buildTemplate(buildApp(parse([
    "name: orders-api", "region: eu-west-1",
    "resources:",
    "  orders:", "    type: table", "    key: id",
    "  uploads:", "    type: bucket",
    "  jobs:", "    type: queue",
    "functions:", "  a:", "    handler: a.handler",
    "    events:", "      - http: GET /a"
  ].join("\n"))));

  const retainedInTemplate = new Set();
  const deletedInTemplate = new Set();
  for (const resource of Object.values(template.Resources)) {
    if (resource.DeletionPolicy === "Retain") retainedInTemplate.add(resource.Type);
    else deletedInTemplate.add(resource.Type);
  }

  assert.ok(retainedInTemplate.size > 0, "the template retains nothing, so this test is checking an empty set");

  for (const type of retainedInTemplate) {
    assert.ok(
      RETAINED_TYPES.includes(type),
      `${type} is retained by the template but removal.js does not list it, so remove would report it as deleted while it survives`
    );
  }
  for (const type of deletedInTemplate) {
    assert.ok(
      DELETED_TYPES.includes(type),
      `${type} is created by the template and classified nowhere in removal.js, so remove would call it unclassified`
    );
  }
});
