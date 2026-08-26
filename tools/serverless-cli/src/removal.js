"use strict";

// What deleting the stack would actually do.
//
// `remove` is the one command here that destroys things, so it gets the same
// treatment `plan` gets and for a stronger reason: there is no change set for a
// delete. CloudFormation will not tell you in advance what a DeleteStack does,
// so this works it out from the stack's own resource list and says it out loud
// before anything is called.
//
// ## Kept and gone are not a detail
//
// `template.js` creates tables and buckets with `DeletionPolicy: Retain`, so
// deleting the stack leaves them behind. That is deliberate -- taking a stack
// down should not be the thing that loses a customer's orders -- but it is only
// a kindness if somebody knows it happened. A retained bucket is a bucket still
// costing money under a name the tool will not reuse, and a person who believes
// they deleted everything has left both.
//
// So the summary has three parts, and none of them is optional:
//
//   gone    what CloudFormation deletes
//   kept    what survives, and therefore what is still there to clean up
//   unknown resource types this file has no rule for
//
// The third exists because the alternative is worse. A type nobody classified
// would otherwise fall into "gone" by default and be reported as deleted when
// nothing here knows whether it will be. Saying "this is not classified" is a
// worse-looking report and a truer one.

// Types `template.js` creates with DeletionPolicy: Retain. Kept in step with it
// by a test rather than by memory -- a type that gains a retain policy in the
// template and not here would be reported as deleted while surviving.
const RETAINED_TYPES = Object.freeze([
  "AWS::DynamoDB::Table",
  "AWS::S3::Bucket"
]);

// Types this tool creates that CloudFormation genuinely deletes.
const DELETED_TYPES = Object.freeze([
  "AWS::Lambda::Function",
  "AWS::Lambda::Permission",
  "AWS::IAM::Role",
  "AWS::Logs::LogGroup",
  "AWS::SQS::Queue",
  "AWS::ApiGatewayV2::Api",
  "AWS::ApiGatewayV2::Stage",
  "AWS::ApiGatewayV2::Integration",
  "AWS::ApiGatewayV2::Route",
  "AWS::Events::Rule"
]);

const FRIENDLY = Object.freeze({
  "AWS::Lambda::Function": "function",
  "AWS::DynamoDB::Table": "table",
  "AWS::S3::Bucket": "bucket",
  "AWS::SQS::Queue": "queue",
  "AWS::IAM::Role": "role",
  "AWS::Logs::LogGroup": "log group",
  "AWS::ApiGatewayV2::Api": "API",
  "AWS::ApiGatewayV2::Stage": "API stage",
  "AWS::ApiGatewayV2::Integration": "API integration",
  "AWS::ApiGatewayV2::Route": "route",
  "AWS::Events::Rule": "schedule",
  "AWS::Lambda::Permission": "permission"
});

function friendlyType(type) {
  return FRIENDLY[type] || type;
}

/**
 * Sort a stack's resources into what goes, what stays, and what is unclassified.
 *
 *   resources  from aws.listStackResources
 *   status     "ready" when the list was read, "unknown" when it could not be
 *
 * `status` is required and has no default, for the same reason `buildPlan`'s is:
 * an empty resource list and a failed read must never render the same way. "This
 * stack contains nothing" is a reason to go ahead; "we could not look" is not.
 */
function buildRemoval({ resources, status, stackName, region }) {
  if (status !== "ready" && status !== "unknown") {
    throw new TypeError(`buildRemoval needs a status of ready or unknown; got ${JSON.stringify(status)}`);
  }

  if (status === "unknown") {
    return {
      known: false,
      safe: false,
      gone: [],
      kept: [],
      unknown: [],
      lines: [
        `Could not read what is in ${stackName} (${region}).`,
        "",
        "Nothing was deleted. This is not the same as the stack being empty -- nothing",
        "was looked at, so there is no way to say what deleting it would destroy."
      ]
    };
  }

  const rows = (Array.isArray(resources) ? resources : []).filter(Boolean);

  const gone = [];
  const kept = [];
  const unknown = [];
  for (const resource of rows) {
    const type = String(resource.resourceType || "");
    const entry = {
      logicalId: String(resource.logicalId || "?"),
      physicalId: resource.physicalId ? String(resource.physicalId) : null,
      type,
      friendly: friendlyType(type)
    };
    if (RETAINED_TYPES.includes(type)) kept.push(entry);
    else if (DELETED_TYPES.includes(type)) gone.push(entry);
    else unknown.push(entry);
  }

  const lines = [];
  lines.push(`Deleting ${stackName} in ${region}.`);
  lines.push("");

  if (!rows.length) {
    lines.push("  The stack has no resources in it.");
    return { known: true, safe: true, gone, kept, unknown, lines };
  }

  if (gone.length) {
    lines.push("  These are deleted:");
    for (const entry of gone) lines.push(`    ${entry.friendly.padEnd(18)} ${entry.logicalId}`);
    lines.push("");
  }

  if (kept.length) {
    // Named individually, with the real AWS name, because this is the list
    // somebody needs in order to finish the job by hand.
    lines.push("  These are KEPT, and are still in your account after this:");
    for (const entry of kept) {
      lines.push(`    ${entry.friendly.padEnd(18)} ${entry.physicalId || entry.logicalId}`);
    }
    lines.push("");
    lines.push("  They hold data, so the stack is built to leave them behind. They also still");
    lines.push("  cost money, and this tool will not reuse their names. Delete them yourself if");
    lines.push("  you want them gone.");
    lines.push("");
  }

  if (unknown.length) {
    lines.push("  This tool has no rule for these, so it cannot say whether they survive:");
    for (const entry of unknown) lines.push(`    ${entry.type} ${entry.logicalId}`);
    lines.push("");
  }

  const parts = [];
  if (gone.length) parts.push(`${gone.length} deleted`);
  if (kept.length) parts.push(`${kept.length} kept`);
  if (unknown.length) parts.push(`${unknown.length} unclassified`);
  lines.push(parts.join(", ") + ".");

  return {
    known: true,
    // "Safe" here means only that nothing is unclassified. It never means the
    // delete is harmless -- a delete is never harmless, which is why it is
    // confirmed regardless of this flag.
    safe: unknown.length === 0,
    gone,
    kept,
    unknown,
    lines
  };
}

module.exports = { buildRemoval, friendlyType, RETAINED_TYPES, DELETED_TYPES, FRIENDLY };
