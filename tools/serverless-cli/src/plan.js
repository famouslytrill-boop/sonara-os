"use strict";

// What will change, said in a way somebody will actually read.
//
// This is the renderer only. It is handed CloudFormation's own answer -- the
// list of changes from a change set, computed against the deployed stack -- and
// turns it into text. It never works out what changed by itself, because a
// local guess is wrong the moment somebody touches the console, and a plan that
// is occasionally wrong is worse than no plan: people stop reading it.
//
// ## The one thing this must never do
//
// **An empty change list and a failed lookup must not print the same thing.**
// "No changes" is a statement about the deployed stack. If the describe call
// failed, or the change set was still being created, or the stack could not be
// read, then nothing is known about the deployed stack and saying "no changes"
// is a lie that ends with somebody deploying blind. Those are separate states
// here and they render differently.

// CloudFormation's replacement flag has three values and only one of them is
// safe to gloss over. "True" means the resource is destroyed and recreated --
// for a table, that is the data.
const REPLACEMENT = Object.freeze({
  True: "replaced",
  Conditional: "possibly replaced",
  False: "changed in place"
});

// Which resource types lose something when they are replaced. A replaced
// Lambda function is a new function with the same code; a replaced table is an
// empty table.
const CARRIES_DATA = Object.freeze([
  "AWS::DynamoDB::Table",
  "AWS::S3::Bucket",
  "AWS::SQS::Queue",
  "AWS::RDS::DBInstance"
]);

const ACTION_WORD = Object.freeze({
  Add: "create",
  Modify: "update",
  Remove: "delete",
  Import: "import",
  Dynamic: "change"
});

function friendlyType(awsType) {
  const known = {
    "AWS::Lambda::Function": "function",
    "AWS::DynamoDB::Table": "table",
    "AWS::S3::Bucket": "bucket",
    "AWS::SQS::Queue": "queue",
    "AWS::IAM::Role": "role",
    "AWS::Logs::LogGroup": "log group",
    "AWS::ApiGatewayV2::Api": "API",
    "AWS::ApiGatewayV2::Route": "route",
    "AWS::ApiGatewayV2::Stage": "API stage",
    "AWS::ApiGatewayV2::Integration": "API integration",
    "AWS::Events::Rule": "schedule",
    "AWS::Lambda::Permission": "permission"
  };
  return known[awsType] || awsType;
}

/**
 * Turn CloudFormation's change list into a plan.
 *
 *   changes    the Changes array from DescribeChangeSet, already unwrapped to
 *              the ResourceChange objects
 *   status     what the describe call said: "ready", "empty", or "unknown"
 *   stackName, region, exists
 *
 * `status` is required and has no default. A default would let a caller that
 * forgot to pass it render "no changes" for a lookup that never happened.
 */
function buildPlan({ changes, status, stackName, region, exists }) {
  if (status !== "ready" && status !== "empty" && status !== "unknown") {
    throw new TypeError(`buildPlan needs a status of ready, empty or unknown; got ${JSON.stringify(status)}`);
  }

  if (status === "unknown") {
    return {
      known: false,
      dangerous: false,
      counts: { create: 0, update: 0, delete: 0 },
      lines: [
        `Could not read what would change in ${stackName} (${region}).`,
        "",
        "This is not the same as nothing changing -- nothing was compared. Deploying now would",
        "apply changes nobody has seen. Fix the error above and run the plan again."
      ]
    };
  }

  if (status === "empty") {
    return {
      known: true,
      dangerous: false,
      counts: { create: 0, update: 0, delete: 0 },
      lines: [`${stackName} (${region}) is already what this file describes. Nothing to do.`]
    };
  }

  const rows = (Array.isArray(changes) ? changes : []).map((change) => {
    const action = String(change.Action || "Dynamic");
    const replacement = change.Replacement ? REPLACEMENT[change.Replacement] || String(change.Replacement) : null;
    const type = String(change.ResourceType || "");
    return {
      action,
      word: ACTION_WORD[action] || "change",
      logicalId: String(change.LogicalResourceId || "?"),
      type,
      friendly: friendlyType(type),
      replacement,
      // A destroyed-and-recreated resource that holds something is the only
      // thing in a plan that deserves to stop somebody.
      losesData: (action === "Remove" || change.Replacement === "True" || change.Replacement === "Conditional")
        && CARRIES_DATA.includes(type)
    };
  });

  const counts = {
    create: rows.filter((row) => row.action === "Add").length,
    update: rows.filter((row) => row.action === "Modify").length,
    delete: rows.filter((row) => row.action === "Remove").length
  };

  const lines = [];
  lines.push(exists
    ? `Changes to ${stackName} in ${region}:`
    : `${stackName} does not exist in ${region} yet. It would be created:`);
  lines.push("");

  // Grouped by what happens to them, worst last, so the thing worth reading is
  // the thing nearest the prompt.
  for (const [action, heading] of [["Add", "create"], ["Modify", "update"], ["Remove", "delete"]]) {
    const group = rows.filter((row) => row.action === action);
    if (!group.length) continue;
    lines.push(`  ${heading}:`);
    for (const row of group) {
      const suffix = row.replacement && row.replacement !== "changed in place" ? `  (${row.replacement})` : "";
      lines.push(`    ${row.friendly.padEnd(18)} ${row.logicalId}${suffix}`);
    }
    lines.push("");
  }

  const dangerous = rows.filter((row) => row.losesData);
  if (dangerous.length) {
    lines.push("  Careful:");
    for (const row of dangerous) {
      lines.push(row.action === "Remove"
        ? `    ${row.logicalId} (${row.friendly}) would be deleted, and what is in it goes with it.`
        : `    ${row.logicalId} (${row.friendly}) would be ${row.replacement}, which means a new empty one.`);
    }
    lines.push("");
  }

  const parts = [];
  if (counts.create) parts.push(`${counts.create} to create`);
  if (counts.update) parts.push(`${counts.update} to update`);
  if (counts.delete) parts.push(`${counts.delete} to delete`);
  lines.push(parts.length ? parts.join(", ") + "." : "Nothing to do.");

  return { known: true, dangerous: dangerous.length > 0, counts, rows, lines };
}

module.exports = { buildPlan, friendlyType, CARRIES_DATA, REPLACEMENT, ACTION_WORD };
