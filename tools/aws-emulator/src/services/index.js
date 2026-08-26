"use strict";

// What this emulator implements, and what it refuses.
//
// This file is the honesty boundary, and it is the most important one in the
// project.
//
// An emulator's failure mode is not crashing. It is **answering**. A service
// that returns `200 {}` for an operation it has not implemented lets the
// caller's code carry on with something that looks like an empty result: no
// items, no messages, no instances. The test passes, the developer ships, and
// the thing breaks against real AWS for a reason nothing local ever hinted at.
//
// So every service is in exactly one of two states, and there is no third:
//
//   **implemented** -- there is a handler, and it is tested
//   **not implemented** -- every call is refused, in that service's own error
//                          dialect, naming the service and saying plainly that
//                          this emulator does not do it
//
// A service is never partly here. If a handler exists but an operation is not
// covered, the handler itself refuses by name -- see the `default` branch in
// each one -- rather than falling through to something generic.
//
// ## Why the unimplemented list is explicit rather than "everything else"
//
// Because "everything else" cannot tell a service it has never heard of from a
// typo. `protocol.js` knows the names of services it does not implement
// precisely so a request for EC2 is answered "this emulator does not implement
// EC2" rather than "could not work out which service this is" -- one sends
// somebody to the README, the other sends them to read the source.

const s3 = require("./s3.js");
const dynamodb = require("./dynamodb.js");
const sqs = require("./sqs.js");
const identity = require("./identity.js");
const lambda = require("./lambda.js");
const { queryErrorXml } = require("../xml.js");

// Handler per service. Being here is a claim that the service works for the
// operations its own file lists, and that there are tests.
const IMPLEMENTED = Object.freeze({
  s3: (request, context) => s3.handle(request, context),
  dynamodb: (request, context) => dynamodb.handle(request, context),
  sqs: (request, context) => sqs.handle(request, context),
  sts: (request, context) => identity.handleSts(request, context),
  iam: (request, context) => identity.handleIam(request, context),
  lambda: (request, context) => lambda.handle(request, context)
});

// Named so a request for one gets a useful refusal rather than "unidentified".
// The text is what somebody reads at 1am, so each says what it would take
// rather than only that it is missing.
const NOT_IMPLEMENTED = Object.freeze({
  ec2: "EC2 is not emulated. Instances, volumes and networks have no local equivalent that would tell you anything true about your code.",
  ecs: "ECS is not emulated. Running a task means running a container, which this single container cannot do for you.",
  rds: "RDS is not emulated. Run the database itself -- Postgres or MySQL in its own container -- and point your code at that; it is a truer test than an emulated control plane.",
  apigateway: "API Gateway is not emulated. Invoke your Lambda directly, or run your handler behind any local HTTP server.",
  "execute-api": "API Gateway is not emulated, so there is nothing here to invoke through it.",
  sns: "SNS is not emulated yet. SQS is, and a queue is usually the half being tested.",
  events: "EventBridge is not emulated yet.",
  secretsmanager: "Secrets Manager is not emulated yet. Environment variables are the local equivalent and are simpler to reason about.",
  ssm: "SSM Parameter Store is not emulated yet.",
  kinesis: "Kinesis is not emulated yet.",
  firehose: "Firehose is not emulated yet.",
  stepfunctions: "Step Functions is not emulated yet.",
  states: "Step Functions is not emulated yet.",
  logs: "CloudWatch Logs is not emulated yet. Lambda output is written to this container's own stdout instead, where docker logs will show it.",
  cloudformation: "CloudFormation is not emulated yet. Create the resources directly -- every service this emulator does implement can be driven from the SDK or the CLI."
});

// The refusal, in a dialect the caller's SDK can parse.
//
// The dialect matters more than it looks. A JSON-protocol SDK handed an XML
// error reports "unknown error" and loses the message entirely, which turns a
// clear refusal into a mystery.
function refuse(service, request, detail) {
  const message = `${detail} (aws-emulator)`;
  const json = Boolean(request.target) || String(request.headers["content-type"] || "").includes("json");
  if (json) {
    return {
      status: 501,
      headers: { "content-type": "application/x-amz-json-1.0" },
      body: JSON.stringify({ __type: "NotImplemented", message })
    };
  }
  return {
    status: 501,
    headers: { "content-type": "application/xml" },
    body: queryErrorXml("NotImplemented", message)
  };
}

function dispatch(request, context) {
  const service = request.service;

  if (service && IMPLEMENTED[service]) return IMPLEMENTED[service](request, context);

  if (service && NOT_IMPLEMENTED[service]) return refuse(service, request, NOT_IMPLEMENTED[service]);

  if (service) {
    return refuse(service, request,
      `This emulator does not implement ${service}, and has no note about it. `
      + `It implements ${Object.keys(IMPLEMENTED).sort().join(", ")}.`);
  }

  // Nothing identified it. `how` says what was tried, because the first
  // question when a request lands in the wrong place is always "why did it
  // think that".
  return refuse("unknown", request,
    `Could not work out which AWS service this request is for (${request.how}). `
    + `Signed requests name their service in the Authorization header; this one did not. `
    + `Implemented services: ${Object.keys(IMPLEMENTED).sort().join(", ")}.`);
}

module.exports = { dispatch, IMPLEMENTED, NOT_IMPLEMENTED, refuse };
