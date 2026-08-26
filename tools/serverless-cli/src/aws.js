"use strict";

// The AWS calls, over fetch, signed by sigv4.js.
//
// CloudFormation and STS are Query APIs: a form-encoded POST with an `Action`
// parameter, answering XML. S3 is REST. Neither needs an SDK, and adding one
// would trade a hundred lines here for several hundred packages.
//
// ## The XML, and why there is a parser here at all
//
// Query APIs answer XML and there is no XML parser in Node. What is needed is
// narrow -- pull named fields out of repeated elements of a known shape -- so
// this extracts exactly that and refuses to pretend to be more. It does not
// handle namespaces, attributes, CDATA or nesting beyond what these responses
// use, and a response it cannot read is reported as unreadable rather than as
// empty. **An empty result and an unparsed result must never look the same**:
// one means the stack has no changes and the other means nobody knows.

const { sign } = require("./sigv4.js");

const CFN_VERSION = "2010-05-15";

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

// Every <tag>...</tag>, as raw inner text, counting depth.
//
// A non-greedy regex was here first and it was wrong, for a reason worth
// keeping: CloudFormation nests same-named tags. A stack looks like
//
//   <Stacks><member> ... <Outputs><member>...</member></Outputs> </member></Stacks>
//
// and `<member>([\s\S]*?)</member>` closes the outer member at the *inner*
// closing tag, so the stack's content is silently truncated before its outputs.
// Nothing throws; the outputs are simply not there. Regular expressions cannot
// count, so this counts.
function elements(xml, tag) {
  const found = [];
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?(/?)>`, "g");
  const close = `</${tag}>`;

  let match;
  while ((match = open.exec(xml)) !== null) {
    // <tag/> is an empty element, not the start of one.
    if (match[1] === "/") { found.push(""); continue; }

    const contentStart = match.index + match[0].length;
    let depth = 1;
    let cursor = contentStart;
    while (depth > 0) {
      const nextClose = xml.indexOf(close, cursor);
      if (nextClose === -1) return found;   // unterminated: stop rather than guess
      open.lastIndex = cursor;
      const nextOpen = open.exec(xml);
      if (nextOpen && nextOpen.index < nextClose && nextOpen[1] !== "/") {
        depth += 1;
        cursor = nextOpen.index + nextOpen[0].length;
        continue;
      }
      depth -= 1;
      cursor = nextClose + close.length;
    }
    found.push(xml.slice(contentStart, cursor - close.length));
    open.lastIndex = cursor;
  }
  return found;
}

function element(xml, tag) {
  const all = elements(xml, tag);
  return all.length ? decodeEntities(all[0].trim()) : null;
}

// The <member> entries of a named list. CloudFormation wraps every list this
// way, so pulling the members of the right list is the whole job.
function members(xml, listTag) {
  const list = elements(xml, listTag);
  if (!list.length) return [];
  return elements(list[0], "member");
}

class AwsError extends Error {
  constructor(message, { code, status, requestId } = {}) {
    super(message);
    this.name = "AwsError";
    this.code = code || "unknown";
    this.status = status || 0;
    this.requestId = requestId || null;
  }
}

// AWS's own error text, which is almost always more useful than anything this
// could write. The code is kept separately so callers can branch on it without
// matching on prose.
function errorFrom(xml, status) {
  const code = element(xml, "Code") || `http_${status}`;
  const message = element(xml, "Message") || `AWS answered ${status}.`;
  return new AwsError(message, { code, status, requestId: element(xml, "RequestId") });
}

async function queryCall({ service, action, region, credentials, parameters, version, fetchImpl = fetch }) {
  const form = new URLSearchParams({ Action: action, Version: version });
  for (const [name, value] of Object.entries(parameters || {})) {
    if (value === undefined || value === null) continue;
    form.set(name, String(value));
  }
  const body = form.toString();
  const host = `${service}.${region}.amazonaws.com`;

  const signed = sign({
    method: "POST",
    host,
    path: "/",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
    region,
    service,
    credentials
  });

  const response = await fetchImpl(`https://${host}/`, { method: "POST", headers: signed.headers, body });
  const text = await response.text();
  if (!response.ok) throw errorFrom(text, response.status);
  return text;
}

// --- CloudFormation ----------------------------------------------------

async function describeStack({ region, credentials, stackName, fetchImpl }) {
  try {
    const xml = await queryCall({
      service: "cloudformation", action: "DescribeStacks", version: CFN_VERSION,
      region, credentials, parameters: { StackName: stackName }, fetchImpl
    });
    const [stack] = members(xml, "Stacks");
    if (!stack) return { exists: false, status: null, outputs: {} };
    const outputs = {};
    for (const output of members(stack, "Outputs")) {
      const key = element(output, "OutputKey");
      if (key) outputs[key] = element(output, "OutputValue");
    }
    return { exists: true, status: element(stack, "StackStatus"), outputs };
  } catch (error) {
    // "does not exist" is an answer, not a failure. Every other error is a
    // failure, and conflating them would report an unreachable account as an
    // empty one -- and then create a stack that already exists.
    if (error instanceof AwsError && /does not exist/i.test(error.message)) {
      return { exists: false, status: null, outputs: {} };
    }
    throw error;
  }
}

const CAPABILITIES = Object.freeze(["CAPABILITY_IAM"]);

async function createChangeSet({ region, credentials, stackName, templateBody, exists, changeSetName, fetchImpl }) {
  const parameters = {
    StackName: stackName,
    ChangeSetName: changeSetName,
    TemplateBody: templateBody,
    ChangeSetType: exists ? "UPDATE" : "CREATE"
  };
  // This template creates IAM roles, so CloudFormation requires the capability
  // to be acknowledged. CAPABILITY_IAM rather than CAPABILITY_NAMED_IAM,
  // because nothing here names a role -- and asking for the wider one when the
  // narrower suffices is how a template later grows a named role nobody
  // reviewed.
  CAPABILITIES.forEach((capability, index) => { parameters[`Capabilities.member.${index + 1}`] = capability; });

  const xml = await queryCall({
    service: "cloudformation", action: "CreateChangeSet", version: CFN_VERSION,
    region, credentials, parameters, fetchImpl
  });
  return { id: element(xml, "Id"), stackId: element(xml, "StackId") };
}

/**
 * Read a change set.
 *
 * Returns { status, changes, reason }. `status` is the word `plan.js` needs:
 * "ready" when there are changes, "empty" when CloudFormation says there are
 * none, "pending" while it is still working it out. Anything unreadable throws
 * rather than returning an empty change list.
 */
async function describeChangeSet({ region, credentials, changeSetId, fetchImpl }) {
  const xml = await queryCall({
    service: "cloudformation", action: "DescribeChangeSet", version: CFN_VERSION,
    region, credentials, parameters: { ChangeSetName: changeSetId }, fetchImpl
  });

  const status = element(xml, "Status");
  const executionStatus = element(xml, "ExecutionStatus");
  const reason = element(xml, "StatusReason");

  if (status === "FAILED") {
    // CloudFormation reports "no changes" as a *failed* change set, which is
    // its oddest interface. Treating every FAILED as an error would make an
    // up-to-date stack look broken; treating every FAILED as empty would hide
    // real template errors. The reason text is the only thing that separates
    // them.
    if (reason && /didn't contain changes|No updates are to be performed/i.test(reason)) {
      return { status: "empty", changes: [], reason };
    }
    throw new AwsError(reason || "The change set could not be created.", { code: "change_set_failed" });
  }

  if (status !== "CREATE_COMPLETE") {
    return { status: "pending", changes: [], reason: reason || status };
  }

  const changes = members(xml, "Changes").map((change) => ({
    Action: element(change, "Action"),
    LogicalResourceId: element(change, "LogicalResourceId"),
    PhysicalResourceId: element(change, "PhysicalResourceId"),
    ResourceType: element(change, "ResourceType"),
    Replacement: element(change, "Replacement")
  }));

  return { status: changes.length ? "ready" : "empty", changes, reason, executionStatus };
}

function executeChangeSet({ region, credentials, changeSetId, fetchImpl }) {
  return queryCall({
    service: "cloudformation", action: "ExecuteChangeSet", version: CFN_VERSION,
    region, credentials, parameters: { ChangeSetName: changeSetId }, fetchImpl
  });
}

function deleteChangeSet({ region, credentials, changeSetId, fetchImpl }) {
  return queryCall({
    service: "cloudformation", action: "DeleteChangeSet", version: CFN_VERSION,
    region, credentials, parameters: { ChangeSetName: changeSetId }, fetchImpl
  });
}

// The events since a moment, newest first, for showing progress during a
// deploy. Only the failures are worth printing, and only once each.
async function stackEvents({ region, credentials, stackName, fetchImpl }) {
  const xml = await queryCall({
    service: "cloudformation", action: "DescribeStackEvents", version: CFN_VERSION,
    region, credentials, parameters: { StackName: stackName }, fetchImpl
  });
  return members(xml, "StackEvents").map((event) => ({
    id: element(event, "EventId"),
    timestamp: element(event, "Timestamp"),
    logicalId: element(event, "LogicalResourceId"),
    resourceType: element(event, "ResourceType"),
    status: element(event, "ResourceStatus"),
    reason: element(event, "ResourceStatusReason")
  }));
}

/**
 * What is actually in the deployed stack.
 *
 * Read from CloudFormation rather than derived from the local YAML, and the
 * difference matters for `remove`: the file on this machine describes what the
 * stack would be, and deleting acts on what it *is*. Somebody who removed a
 * resource from the file and never deployed would otherwise be shown a list
 * missing the very thing that is about to be deleted.
 */
async function listStackResources({ region, credentials, stackName, fetchImpl }) {
  const xml = await queryCall({
    service: "cloudformation", action: "ListStackResources", version: CFN_VERSION,
    region, credentials, parameters: { StackName: stackName }, fetchImpl
  });
  return members(xml, "StackResourceSummaries").map((entry) => ({
    logicalId: element(entry, "LogicalResourceId"),
    physicalId: element(entry, "PhysicalResourceId"),
    resourceType: element(entry, "ResourceType"),
    status: element(entry, "ResourceStatus")
  }));
}

function deleteStack({ region, credentials, stackName, fetchImpl }) {
  return queryCall({
    service: "cloudformation", action: "DeleteStack", version: CFN_VERSION,
    region, credentials, parameters: { StackName: stackName }, fetchImpl
  });
}

// --- S3 ----------------------------------------------------------------

async function putObject({ region, credentials, bucket, key, body, fetchImpl = fetch }) {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const path = `/${key}`;
  const signed = sign({
    method: "PUT", host, path, body,
    headers: { "content-type": "application/zip", "content-length": String(body.length) },
    region, service: "s3", credentials
  });
  const response = await fetchImpl(`https://${host}${path}`, { method: "PUT", headers: signed.headers, body });
  if (!response.ok) throw errorFrom(await response.text(), response.status);
  return { bucket, key };
}

async function objectExists({ region, credentials, bucket, key, fetchImpl = fetch }) {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const path = `/${key}`;
  const signed = sign({ method: "HEAD", host, path, body: "", region, service: "s3", credentials });
  const response = await fetchImpl(`https://${host}${path}`, { method: "HEAD", headers: signed.headers });
  if (response.status === 404) return false;
  if (!response.ok) throw new AwsError(`Could not check for the package in ${bucket}.`, { status: response.status });
  return true;
}

async function createBucket({ region, credentials, bucket, fetchImpl = fetch }) {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  // us-east-1 is the one region where a LocationConstraint is an error rather
  // than a requirement.
  const body = region === "us-east-1"
    ? ""
    : `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
  const signed = sign({
    method: "PUT", host, path: "/", body,
    headers: body ? { "content-type": "application/xml" } : {},
    region, service: "s3", credentials
  });
  const response = await fetchImpl(`https://${host}/`, { method: "PUT", headers: signed.headers, body: body || undefined });
  if (response.ok) return true;
  const text = await response.text();
  // Already ours is success. Racing two deploys should not fail either of them.
  if (/BucketAlreadyOwnedByYou/.test(text)) return true;
  throw errorFrom(text, response.status);
}

// --- STS ---------------------------------------------------------------

async function callerIdentity({ region, credentials, fetchImpl }) {
  const xml = await queryCall({
    service: "sts", action: "GetCallerIdentity", version: "2011-06-15",
    region, credentials, parameters: {}, fetchImpl
  });
  return {
    account: element(xml, "Account"),
    arn: element(xml, "Arn"),
    userId: element(xml, "UserId")
  };
}

module.exports = {
  AwsError,
  describeStack, createChangeSet, describeChangeSet, executeChangeSet, deleteChangeSet, stackEvents,
  listStackResources, deleteStack,
  putObject, objectExists, createBucket,
  callerIdentity,
  queryCall, elements, element, members, decodeEntities, errorFrom, CAPABILITIES
};
