"use strict";

// What the YAML turns into, and the two things that must never drift.
//
// **Logical IDs.** A logical ID is how CloudFormation knows the function in the
// new template is the same one as in the deployed stack. Change an ID and it
// deletes one resource and creates another -- and for a table, that is the data.
// So the derivation is tested directly, and tested to be stable when unrelated
// lines change.
//
// **Grants.** A permission that is too narrow shows up as a failing request. A
// permission that is too wide shows up as nothing at all, until it matters.

const test = require("node:test");
const assert = require("node:assert/strict");

const { parse } = require("../src/yaml.js");
const { buildApp } = require("../src/manifest.js");
const { buildTemplate, logicalId, actionsFor } = require("../src/template.js");

function templateFor(yaml, options) {
  return buildTemplate(buildApp(parse(yaml)), options);
}

const FULL = [
  "name: orders-api",
  "region: eu-west-1",
  "environment:",
  "  STAGE: prod",
  "resources:",
  "  orders:",
  "    type: table",
  "    key: id",
  "  uploads:",
  "    type: bucket",
  "  jobs:",
  "    type: queue",
  "functions:",
  "  checkout:",
  "    handler: handlers/checkout.handler",
  "    memory: 1024",
  "    uses:",
  "      orders: readwrite",
  "      uploads: read",
  "    events:",
  "      - http: POST /checkout",
  "  nightly:",
  "    handler: handlers/nightly.handler",
  "    events:",
  "      - schedule: rate(1 day)"
].join("\n");

test("derives a stable logical ID from the name somebody wrote", () => {
  assert.equal(logicalId("Fn", "checkout"), "FnCheckout");
  assert.equal(logicalId("Fn", "orders-api"), "FnOrdersApi");
  assert.equal(logicalId("Table", "customer_orders"), "TableCustomerOrders");
});

test("the same file always produces the same template, byte for byte", () => {
  const once = JSON.stringify(templateFor(FULL));
  const twice = JSON.stringify(templateFor(FULL));
  assert.equal(once, twice, "the template varies between calls, so a plan would show changes that are not changes");
});

test("adding an unrelated function does not renumber the existing one", () => {
  const before = templateFor(FULL);
  const after = templateFor(FULL + "\n  extra:\n    handler: handlers/extra.handler");
  assert.deepEqual(
    before.Resources.FnCheckout,
    after.Resources.FnCheckout,
    "adding a function changed an existing function's definition, which is a replacement nobody asked for"
  );
  assert.ok(after.Resources.FnExtra, "the new function is missing");
});

test("creates the three resource types with the properties that matter", () => {
  const template = templateFor(FULL);
  assert.equal(template.Resources.TableOrders.Type, "AWS::DynamoDB::Table");
  assert.equal(template.Resources.BucketUploads.Type, "AWS::S3::Bucket");
  assert.equal(template.Resources.QueueJobs.Type, "AWS::SQS::Queue");
  assert.equal(template.Resources.TableOrders.Properties.BillingMode, "PAY_PER_REQUEST");
});

test("keeps a table and a bucket when the stack goes away", () => {
  const template = templateFor(FULL);
  assert.equal(template.Resources.TableOrders.DeletionPolicy, "Retain",
    "deleting the stack would delete the table, and with it the data");
  assert.equal(template.Resources.BucketUploads.DeletionPolicy, "Retain");
  assert.equal(template.Resources.TableOrders.UpdateReplacePolicy, "Retain",
    "a change that replaces the table would delete the old one");
});

test("blocks public access and encrypts a bucket, with no way to ask otherwise", () => {
  const bucket = templateFor(FULL).Resources.BucketUploads.Properties;
  assert.deepEqual(bucket.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
  });
  assert.equal(bucket.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.SSEAlgorithm, "AES256");
});

test("grants exactly what was asked for, and nothing on a resource that was not", () => {
  const role = templateFor(FULL).Resources.RoleCheckout.Properties;
  const resourcePolicy = role.Policies.find((policy) => policy.PolicyName === "resources");
  const flat = JSON.stringify(resourcePolicy.PolicyDocument);

  assert.match(flat, /dynamodb:PutItem/, "readwrite on the table did not grant writes");
  assert.match(flat, /dynamodb:GetItem/, "readwrite on the table did not grant reads");
  assert.match(flat, /s3:GetObject/, "read on the bucket did not grant reads");
  assert.ok(!/s3:PutObject/.test(flat), "read on the bucket granted writes as well");
  assert.ok(!/sqs:/.test(flat), "the queue was granted to a function that never asked for it");
});

test("grants a bucket's contents as well as the bucket itself", () => {
  const role = templateFor(FULL).Resources.RoleCheckout.Properties;
  const resourcePolicy = role.Policies.find((policy) => policy.PolicyName === "resources");
  const bucketStatement = resourcePolicy.PolicyDocument.Statement.find((s) => JSON.stringify(s).includes("s3:GetObject"));
  assert.equal(bucketStatement.Resource.length, 2,
    "only the bucket ARN was granted, so every s3:GetObject would be denied while the policy looks right");
  assert.match(JSON.stringify(bucketStatement.Resource), /\/\*/);
});

test("scopes log writes to the function's own log group", () => {
  const role = templateFor(FULL).Resources.RoleCheckout.Properties;
  const logs = role.Policies.find((policy) => policy.PolicyName === "logs");
  assert.match(JSON.stringify(logs.PolicyDocument), /LogsCheckout/,
    "log permission is not scoped to this function's group");
  assert.ok(!/\"logs:\*\"/.test(JSON.stringify(logs.PolicyDocument)), "logs:* was granted");
});

test("gives a function that uses nothing a role with logs and no empty policy", () => {
  const template = templateFor([
    "name: a", "region: eu-west-1",
    "functions:", "  solo:", "    handler: a.handler"
  ].join("\n"));
  const policies = template.Resources.RoleSolo.Properties.Policies;
  assert.equal(policies.length, 1, "a function that uses nothing got a second policy with an empty statement list, which CloudFormation rejects");
  assert.equal(policies[0].PolicyName, "logs");
});

test("creates an API only when something is reachable over HTTP", () => {
  assert.ok(templateFor(FULL).Resources.HttpApi, "the application has a route but no API was created");
  const noRoutes = templateFor("name: a\nregion: eu-west-1\nfunctions:\n  b:\n    handler: a.handler");
  assert.ok(!noRoutes.Resources.HttpApi, "an API was created for an application with no routes");
  assert.ok(!noRoutes.Outputs, "an application with no API still advertised a URL");
});

test("routes a request to the function that declared it", () => {
  const template = templateFor(FULL);
  const route = template.Resources.RouteCheckout0;
  assert.equal(route.Properties.RouteKey, "POST /checkout");
  assert.match(JSON.stringify(route.Properties.Target), /IntegrationCheckout/);
});

test("lets API Gateway invoke the function, but only through this API", () => {
  const permission = templateFor(FULL).Resources.PermCheckoutHttp.Properties;
  assert.equal(permission.Principal, "apigateway.amazonaws.com");
  assert.ok(permission.SourceArn, "any API in the account could invoke this function");
  assert.match(JSON.stringify(permission.SourceArn), /HttpApi/);
});

test("lets EventBridge invoke a scheduled function, but only through its own rule", () => {
  const template = templateFor(FULL);
  assert.equal(template.Resources.ScheduleNightly0.Properties.ScheduleExpression, "rate(1 day)");
  const permission = template.Resources.SchedulePermNightly0.Properties;
  assert.equal(permission.Principal, "events.amazonaws.com");
  assert.match(JSON.stringify(permission.SourceArn), /ScheduleNightly0/,
    "any EventBridge rule in the account could invoke this function");
});

test("puts the shared environment on every function", () => {
  const template = templateFor(FULL);
  assert.equal(template.Resources.FnCheckout.Properties.Environment.Variables.STAGE, "prod");
  assert.equal(template.Resources.FnNightly.Properties.Environment.Variables.STAGE, "prod");
});

test("points at the uploaded package when there is one", () => {
  const template = templateFor(FULL, { codeBucket: "b", codeKey: "k.zip" });
  assert.deepEqual(template.Resources.FnCheckout.Properties.Code, { S3Bucket: "b", S3Key: "k.zip" });
});

test("still builds a valid template before anything is uploaded", () => {
  // `plan` runs before the package exists. A template that could not be built
  // until after an upload would make the preview depend on the thing it is
  // supposed to preview.
  const template = templateFor(FULL);
  assert.ok(template.Resources.FnCheckout.Properties.Code.ZipFile,
    "a template built without an uploaded package has no code at all, so it is not a valid template");
});

test("names the actions each permission level means", () => {
  assert.deepEqual(actionsFor("bucket", "read"), ["s3:GetObject", "s3:ListBucket"]);
  assert.deepEqual(actionsFor("queue", "write"), ["sqs:SendMessage"]);
  assert.equal(actionsFor("table", "readwrite").length, 8);
});
