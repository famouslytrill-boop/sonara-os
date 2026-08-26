"use strict";

// Working out which AWS service a request is for.
//
// Everything on one port means this file is the whole front door: an SDK sends
// a request for DynamoDB and one for S3 to the same socket, and something has
// to tell them apart before either can be answered. AWS itself never has to do
// this -- each service has its own hostname -- so there is no specification to
// follow, only the four things SDKs actually put on the wire.
//
// ## The four signals, in the order they are trusted
//
// 1. **The SigV4 credential scope.** `Authorization: AWS4-HMAC-SHA256
//    Credential=KEY/20260826/eu-west-1/dynamodb/aws4_request` names the service
//    outright. Every signed SDK request has it, and it is the signer's own
//    opinion rather than a guess, so it wins.
// 2. **`X-Amz-Target`.** JSON-protocol services send `DynamoDB_20120810.GetItem`
//    or `AWSSecurityTokenServiceV20110615.GetCallerIdentity`.
// 3. **The Host header.** `bucket.s3.localhost:4566` or `sqs.localhost:4566`.
// 4. **The shape of the request.** A form-encoded `Action=CreateStack` is
//    CloudFormation; a bare path with no other signal is S3, which is the only
//    service here that addresses objects by path.
//
// ## Refusing to guess
//
// If none of those identifies a service, this returns `null` and the caller
// answers with an error saying so. That matters more than it looks: an emulator
// that defaults an unidentifiable request to S3 answers a DynamoDB call with an
// S3 error, and whoever is debugging spends an hour on the wrong service. The
// error names what was tried.

// Every service this emulator has a name for, whether or not it is implemented.
// Being on this list is not a claim that it works -- `IMPLEMENTED` in
// `services/index.js` decides that -- it is only a claim that a request naming
// it can be routed rather than mistaken for something else.
const KNOWN_SERVICES = Object.freeze([
  "s3", "dynamodb", "sqs", "sns", "lambda", "sts", "iam", "cloudformation",
  "logs", "ec2", "ecs", "rds", "apigateway", "execute-api", "events",
  "secretsmanager", "ssm", "kinesis", "firehose", "stepfunctions", "states"
]);

// `X-Amz-Target` prefixes to service names. The prefix is the service's own
// wire name and a version, and neither is guessable from the service name, so
// they are written out.
const TARGET_PREFIXES = Object.freeze({
  DynamoDB_: "dynamodb",
  AWSSecurityTokenServiceV: "sts",
  AmazonSQS: "sqs",
  Logs_: "logs",
  AWSLambda: "lambda",
  AWSEvents: "events",
  Kinesis_: "kinesis",
  secretsmanager: "secretsmanager",
  AmazonSSM: "ssm",
  AWSStepFunctions: "states"
});

function headerOf(headers, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === wanted) return Array.isArray(value) ? value[0] : value;
  }
  return "";
}

/**
 * The credential scope out of an Authorization header.
 *
 * Returns { accessKeyId, date, region, service } or null. Deliberately does not
 * *verify* the signature -- see `src/server.js` for why an emulator that
 * rejected a wrong signature would spend its life failing for reasons nobody
 * cares about locally -- but the scope is still read, because it is the most
 * reliable statement of intent on the request.
 */
function credentialScope(authorization) {
  const match = String(authorization || "").match(
    /Credential=([^/\s]+)\/(\d{8})\/([a-z0-9-]+)\/([a-z0-9-]+)\/aws4_request/i
  );
  if (!match) return null;
  return { accessKeyId: match[1], date: match[2], region: match[3], service: match[4] };
}

// A host like `my-bucket.s3.localhost` or `sqs.eu-west-1.amazonaws.com`. The
// bucket is returned separately because S3's virtual-host addressing puts it
// there, and the S3 service needs it.
function fromHost(host) {
  const bare = String(host || "").split(":")[0].toLowerCase();
  if (!bare) return { service: null, bucket: null };

  const labels = bare.split(".");
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    if (!KNOWN_SERVICES.includes(label)) continue;
    // `bucket.s3.host` -- everything before the service label is the bucket,
    // which is how virtual-host-style S3 addresses a bucket with dots in it.
    const bucket = label === "s3" && index > 0 ? labels.slice(0, index).join(".") : null;
    return { service: label, bucket };
  }
  return { service: null, bucket: null };
}

function fromTarget(target) {
  const text = String(target || "");
  if (!text) return null;
  for (const [prefix, service] of Object.entries(TARGET_PREFIXES)) {
    if (text.startsWith(prefix)) return service;
  }
  return null;
}

// The action name, which every service needs and each states differently.
function actionFrom({ target, body, query, method, path }) {
  const targetText = String(target || "");
  if (targetText.includes(".")) return targetText.split(".").pop();

  // Query-protocol services (CloudFormation, STS, SQS's older interface, EC2)
  // put `Action=` in a form-encoded body or the query string.
  const fromBody = String(body || "").match(/(?:^|&)Action=([A-Za-z0-9_]+)/);
  if (fromBody) return fromBody[1];
  if (query && query.get && query.get("Action")) return query.get("Action");

  // REST services -- S3, Lambda's invoke, API Gateway -- have no action name.
  // The method and the path are the action, and the service works it out.
  return `${String(method || "GET").toUpperCase()} ${path || "/"}`;
}

/**
 * Identify a request.
 *
 * Returns { service, action, bucket, region, accessKeyId, how } where `how`
 * records which signal decided it. `how` is not decoration: when a request is
 * routed to the wrong service, the first question is always "why did it think
 * that", and an emulator that cannot answer sends people to read its source.
 */
function identify({ method, path, headers = {}, body = "", query = null }) {
  const authorization = headerOf(headers, "authorization");
  const target = headerOf(headers, "x-amz-target");
  const host = headerOf(headers, "host");

  const scope = credentialScope(authorization);
  const host_ = fromHost(host);
  const action = actionFrom({ target, body, query, method, path });

  const base = {
    action,
    bucket: host_.bucket,
    region: scope?.region || "us-east-1",
    accessKeyId: scope?.accessKeyId || null,
    target: target || null
  };

  // 1. The signer said so.
  if (scope?.service) {
    // `execute-api` is API Gateway's data plane and signs as itself.
    const service = scope.service === "execute-api" ? "execute-api" : scope.service;
    return { ...base, service, how: "credential scope" };
  }

  // 2. The target prefix.
  const fromTargetHeader = fromTarget(target);
  if (fromTargetHeader) return { ...base, service: fromTargetHeader, how: "x-amz-target" };

  // 3. The host.
  if (host_.service) return { ...base, service: host_.service, how: "host" };

  // 4. The shape. A form-encoded Action= with no other signal is a query
  // protocol service, and the action name is the only clue left.
  if (/(?:^|&)Action=/.test(String(body || "")) || (query && query.get && query.get("Action"))) {
    // Deliberately not guessed. Several services share action names --
    // CreateTable, DeleteTable, ListTags -- and picking one produces an answer
    // in the wrong dialect, which is harder to debug than a refusal.
    return { ...base, service: null, how: "unidentified query protocol" };
  }

  // 5. A plain path with nothing else. S3 is the only service here addressed
  // that way, and an unsigned browser GET of an object is a real thing.
  if (path && path !== "/") return { ...base, service: "s3", how: "path only" };

  return { ...base, service: null, how: "nothing identified it" };
}

module.exports = { identify, credentialScope, fromHost, fromTarget, actionFrom, headerOf, KNOWN_SERVICES, TARGET_PREFIXES };
