"use strict";

// The emulator, driven over HTTP the way a real SDK drives it.
//
// Every test here goes through a socket. Calling the service handlers directly
// would be faster and would skip the half most likely to be wrong: which
// service a request is routed to, whether the body arrived intact, and whether
// the answer parses as the dialect the caller's SDK expects.
//
// The property this file exists to hold is the one in `services/index.js`: an
// emulator's dangerous failure is **answering**, not crashing. A 200 with an
// empty body for something unimplemented lets a caller carry on with what looks
// like "no items", and the bug surfaces against real AWS weeks later. So a
// large share of these tests assert on refusals.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { createServer } = require("../src/server.js");
const { Store } = require("../src/store.js");
const { identify } = require("../src/protocol.js");
const { IMPLEMENTED, NOT_IMPLEMENTED } = require("../src/services/index.js");
const { createZip } = require("../../../lib/sonara-zip.cjs");

// A signed request, the way every SDK sends one. The signature is nonsense on
// purpose: this emulator reads the credential scope and never verifies the
// signature, and a test that supplied a real one would hide it if that changed.
function signed(service, extra = {}) {
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=test/20260826/eu-west-1/${service}/aws4_request, SignedHeaders=host;x-amz-date, Signature=deadbeef`,
    ...extra
  };
}

async function withServer(run) {
  const store = new Store();
  const server = createServer({ store, quiet: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run({ base, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// A request with headers `fetch` will not let a caller set -- Host, chiefly.
function rawRequest(base, { method = "GET", path: path_ = "/", headers = {}, body = null }) {
  const target = new URL(base);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: target.hostname,
      port: target.port,
      method,
      path: path_,
      headers
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        text: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

const call = async (base, path_, options = {}) => {
  const response = await fetch(base + path_, options);
  return { status: response.status, headers: response.headers, text: await response.text() };
};

const json = (base, service, target, payload) => call(base, "/", {
  method: "POST",
  headers: signed(service, { "x-amz-target": target, "content-type": "application/x-amz-json-1.0" }),
  body: JSON.stringify(payload)
});

const query = (base, service, body) => call(base, "/", {
  method: "POST",
  headers: signed(service, { "content-type": "application/x-www-form-urlencoded" }),
  body
});

// --- what it says about itself ------------------------------------------

test("says what it implements, from the registry rather than a written list", async () => {
  await withServer(async ({ base }) => {
    const health = JSON.parse((await call(base, "/_emulator/health")).text);
    assert.ok(health.implemented.length >= 5, "almost nothing is implemented, so the tests below check almost nothing");
    assert.deepEqual(health.implemented, Object.keys(IMPLEMENTED).sort());
    // The two things somebody must be able to find out without reading source.
    assert.equal(health.authenticates, false);
    assert.equal(health.evaluatesIamPolicies, false);
  });
});

// --- routing -------------------------------------------------------------

test("routes by the credential scope before anything else", () => {
  // The signer's own statement of intent, and the only signal that is never a
  // guess. A host header saying s3 must not beat it.
  const identified = identify({
    method: "POST",
    path: "/",
    headers: { ...signed("dynamodb"), host: "s3.localhost:4566" },
    body: ""
  });
  assert.equal(identified.service, "dynamodb");
  assert.equal(identified.how, "credential scope");
});

test("routes an unsigned request by its target header, then by its host", () => {
  assert.equal(identify({ method: "POST", path: "/", headers: { "x-amz-target": "DynamoDB_20120810.GetItem" } }).service, "dynamodb");
  assert.equal(identify({ method: "POST", path: "/", headers: { host: "sqs.localhost:4566" } }).service, "sqs");
  assert.equal(identify({ method: "GET", path: "/b/k", headers: { host: "bucket.s3.localhost" } }).bucket, "bucket");
});

test("refuses to guess when nothing identifies the service", async () => {
  await withServer(async ({ base }) => {
    // A form-encoded Action with no scope, no target and no host. Several
    // services share action names, and picking one answers in the wrong dialect.
    const answered = await call(base, "/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", host: "127.0.0.1" },
      body: "Action=DescribeTable&TableName=x"
    });
    assert.equal(answered.status, 501);
    assert.match(answered.text, /Could not work out which AWS service/);
    assert.match(answered.text, /Implemented services/, "the refusal does not say what it can do instead");
  });
});

// --- the honesty boundary ------------------------------------------------

test("refuses every unimplemented service by name rather than answering", async () => {
  await withServer(async ({ base }) => {
    assert.ok(Object.keys(NOT_IMPLEMENTED).length >= 5, "the unimplemented list is empty, so this checks nothing");
    for (const service of Object.keys(NOT_IMPLEMENTED)) {
      const answered = await query(base, service, "Action=DescribeAnything");
      assert.equal(answered.status, 501, `${service} answered ${answered.status} rather than refusing`);
      assert.match(answered.text, /NotImplemented/, `${service} did not say it is not implemented`);
      assert.ok(
        !/<Items>|"Items"|<Reservations>/.test(answered.text),
        `${service} answered with something that could be read as an empty result`
      );
    }
  });
});

test("refuses in the dialect the caller's SDK can read", async () => {
  await withServer(async ({ base }) => {
    // A JSON-protocol SDK handed XML reports "unknown error" and loses the
    // message, turning a clear refusal into a mystery.
    const asJson = await call(base, "/", {
      method: "POST",
      headers: signed("kinesis", { "x-amz-target": "Kinesis_20131202.PutRecord", "content-type": "application/x-amz-json-1.1" }),
      body: "{}"
    });
    assert.equal(asJson.status, 501);
    assert.equal(JSON.parse(asJson.text).__type, "NotImplemented");

    const asXml = await query(base, "ec2", "Action=DescribeInstances");
    assert.match(asXml.text, /^<\?xml/);
  });
});

test("names the operation when a service it does implement is asked for one it does not", async () => {
  await withServer(async ({ base }) => {
    await json(base, "dynamodb", "DynamoDB_20120810.CreateTable", {
      TableName: "t", KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }]
    });
    const refused = await json(base, "dynamodb", "DynamoDB_20120810.TransactWriteItems", {});
    assert.equal(refused.status, 400);
    const body = JSON.parse(refused.text);
    assert.match(body.message, /TransactWriteItems/, "the refusal does not name the operation");
    assert.match(body.message, /would look like success/);
  });
});

// --- S3 ------------------------------------------------------------------

test("S3 round-trips an object, with a real ETag", async () => {
  await withServer(async ({ base }) => {
    assert.equal((await call(base, "/things", { method: "PUT", headers: signed("s3") })).status, 200);

    const put = await call(base, "/things/note.txt", { method: "PUT", headers: signed("s3"), body: "hello world" });
    assert.equal(put.status, 200);
    // The MD5 of "hello world". Real S3 returns this and SDKs check it; a
    // random ETag would pass here and fail there.
    assert.equal(put.headers.get("etag"), '"5eb63bbbe01eeed093cb22bb8f5acdc3"');

    const got = await call(base, "/things/note.txt", { headers: signed("s3") });
    assert.equal(got.text, "hello world");
  });
});

test("S3 answers both addressing styles", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/pics", { method: "PUT", headers: signed("s3") });
    await call(base, "/pics/a.txt", { method: "PUT", headers: signed("s3"), body: "path style" });
    // Virtual-host style: the bucket is in the Host header, the key is the path.
    //
    // Sent through `node:http` rather than `fetch`, because `fetch` sets Host
    // from the URL and ignores a caller's own -- it is a forbidden header
    // there. A test written with fetch cannot express this case at all, and
    // the first version of it looked like an emulator bug when the emulator
    // was right.
    const virtual = await rawRequest(base, {
      method: "GET",
      path: "/a.txt",
      headers: { ...signed("s3"), host: "pics.s3.localhost" }
    });
    assert.equal(virtual.text, "path style", "virtual-host addressing found nothing, so half the SDKs would get NoSuchBucket");
  });
});

test("S3 keeps a missing key and a missing bucket apart", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/here", { method: "PUT", headers: signed("s3") });
    const noKey = await call(base, "/here/gone.txt", { headers: signed("s3") });
    assert.equal(noKey.status, 404);
    assert.match(noKey.text, /NoSuchKey/);
    const noBucket = await call(base, "/nowhere/gone.txt", { headers: signed("s3") });
    assert.match(noBucket.text, /NoSuchBucket/, "a missing bucket reported as a missing key sends somebody to the wrong problem");
  });
});

test("S3 refuses to delete a bucket with things in it, as S3 does", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/full", { method: "PUT", headers: signed("s3") });
    await call(base, "/full/a.txt", { method: "PUT", headers: signed("s3"), body: "x" });
    const refused = await call(base, "/full", { method: "DELETE", headers: signed("s3") });
    assert.match(refused.text, /BucketNotEmpty/,
      "a teardown script written against this would work locally and fail against AWS");
  });
});

test("S3 accepts a repeated create, because racing deploys must not fail", async () => {
  await withServer(async ({ base }) => {
    assert.equal((await call(base, "/twice", { method: "PUT", headers: signed("s3") })).status, 200);
    assert.equal((await call(base, "/twice", { method: "PUT", headers: signed("s3") })).status, 200);
  });
});

test("S3 refuses a bucket name AWS would refuse", async () => {
  await withServer(async ({ base }) => {
    const refused = await call(base, "/MyBucket", { method: "PUT", headers: signed("s3") });
    assert.match(refused.text, /InvalidBucketName/,
      "a name AWS rejects was accepted here, so the test that used it would only fail in production");
  });
});

test("S3 carries binary through unchanged", async () => {
  await withServer(async ({ base }) => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 0, 128]);
    await call(base, "/bin", { method: "PUT", headers: signed("s3") });
    await call(base, "/bin/blob", { method: "PUT", headers: signed("s3"), body: bytes });
    const response = await fetch(`${base}/bin/blob`, { headers: signed("s3") });
    const back = Buffer.from(await response.arrayBuffer());
    assert.ok(back.equals(bytes), "binary was mangled, which is the failure that looks like a corrupt file");
  });
});

// --- DynamoDB ------------------------------------------------------------

async function seedTable(base) {
  await json(base, "dynamodb", "DynamoDB_20120810.CreateTable", {
    TableName: "notes",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST"
  });
}

test("DynamoDB stores and reads an item back", async () => {
  await withServer(async ({ base }) => {
    await seedTable(base);
    await json(base, "dynamodb", "DynamoDB_20120810.PutItem", { TableName: "notes", Item: { id: { S: "a" }, text: { S: "one" } } });
    const got = JSON.parse((await json(base, "dynamodb", "DynamoDB_20120810.GetItem", { TableName: "notes", Key: { id: { S: "a" } } })).text);
    assert.deepEqual(got.Item, { id: { S: "a" }, text: { S: "one" } });
  });
});

test("DynamoDB reports a missing item as absent, not as an empty item", async () => {
  await withServer(async ({ base }) => {
    await seedTable(base);
    const got = JSON.parse((await json(base, "dynamodb", "DynamoDB_20120810.GetItem", { TableName: "notes", Key: { id: { S: "nope" } } })).text);
    assert.ok(!("Item" in got), "an absent item came back as a key, which SDKs read as found-and-empty");
  });
});

test("DynamoDB treats numerically equal keys as the same key", async () => {
  await withServer(async ({ base }) => {
    await json(base, "dynamodb", "DynamoDB_20120810.CreateTable", {
      TableName: "counters",
      KeySchema: [{ AttributeName: "n", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "n", AttributeType: "N" }]
    });
    await json(base, "dynamodb", "DynamoDB_20120810.PutItem", { TableName: "counters", Item: { n: { N: "1" }, hits: { N: "5" } } });
    // `{"N":"1"}` and `{"N":"1.0"}` are one key to DynamoDB and two JSON
    // strings. Keying on the text lets somebody write an item and fail to read
    // it back with a key their code considers identical.
    const got = JSON.parse((await json(base, "dynamodb", "DynamoDB_20120810.GetItem", { TableName: "counters", Key: { n: { N: "1.0" } } })).text);
    assert.ok(got.Item, "1 and 1.0 were treated as different keys, and DynamoDB does not");
  });
});

test("DynamoDB refuses a Query it cannot answer rather than returning everything", async () => {
  await withServer(async ({ base }) => {
    await seedTable(base);
    await json(base, "dynamodb", "DynamoDB_20120810.PutItem", { TableName: "notes", Item: { id: { S: "a" } } });
    await json(base, "dynamodb", "DynamoDB_20120810.PutItem", { TableName: "notes", Item: { id: { S: "b" } } });
    const refused = await json(base, "dynamodb", "DynamoDB_20120810.Query", {
      TableName: "notes",
      KeyConditionExpression: "id > :k",
      ExpressionAttributeValues: { ":k": { S: "a" } }
    });
    assert.equal(refused.status, 400, "an unsupported Query returned rows, which would look like a working query");
    assert.match(JSON.parse(refused.text).message, /refuses rather than returning every item/);
  });
});

test("DynamoDB refuses ADD in an update rather than getting a counter subtly wrong", async () => {
  await withServer(async ({ base }) => {
    await seedTable(base);
    const refused = await json(base, "dynamodb", "DynamoDB_20120810.UpdateItem", {
      TableName: "notes", Key: { id: { S: "a" } }, UpdateExpression: "ADD hits :one",
      ExpressionAttributeValues: { ":one": { N: "1" } }
    });
    assert.equal(refused.status, 400);
    assert.match(JSON.parse(refused.text).message, /SET and REMOVE/);
  });
});

test("DynamoDB says a table is missing rather than inventing one", async () => {
  await withServer(async ({ base }) => {
    const answered = await json(base, "dynamodb", "DynamoDB_20120810.PutItem", { TableName: "ghost", Item: { id: { S: "a" } } });
    assert.equal(answered.status, 400);
    assert.match(JSON.parse(answered.text).__type, /ResourceNotFoundException/);
  });
});

// --- SQS -----------------------------------------------------------------

async function makeQueue(base, name = "jobs") {
  const made = await query(base, "sqs", `Action=CreateQueue&QueueName=${name}`);
  return made.text.match(/<QueueUrl>([^<]+)</)[1];
}

test("SQS hides a message while it is in flight", async () => {
  await withServer(async ({ base }) => {
    const url = await makeQueue(base);
    await query(base, "sqs", `Action=SendMessage&QueueUrl=${encodeURIComponent(url)}&MessageBody=work`);

    const first = await query(base, "sqs", `Action=ReceiveMessage&QueueUrl=${encodeURIComponent(url)}`);
    assert.match(first.text, /<Body>work<\/Body>/);

    // The whole point of a queue. Handing the same message to two consumers is
    // not emulating SQS, it is emulating a list.
    const second = await query(base, "sqs", `Action=ReceiveMessage&QueueUrl=${encodeURIComponent(url)}`);
    assert.ok(!/<Message>/.test(second.text), "the same message was handed out twice while still in flight");
  });
});

test("SQS gives a message back when its visibility lapses", async () => {
  await withServer(async ({ base }) => {
    const url = await makeQueue(base);
    await query(base, "sqs", `Action=SendMessage&QueueUrl=${encodeURIComponent(url)}&MessageBody=retry-me`);
    // One second, so a crashed worker's message really does come back.
    await query(base, "sqs", `Action=ReceiveMessage&QueueUrl=${encodeURIComponent(url)}&VisibilityTimeout=1`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await query(base, "sqs", `Action=ReceiveMessage&QueueUrl=${encodeURIComponent(url)}`);
    assert.match(again.text, /retry-me/, "a message whose visibility lapsed never came back, so a crashed worker loses work");
  });
});

test("SQS counts a deleted message as gone", async () => {
  await withServer(async ({ base }) => {
    const url = await makeQueue(base);
    await query(base, "sqs", `Action=SendMessage&QueueUrl=${encodeURIComponent(url)}&MessageBody=one`);
    const got = await query(base, "sqs", `Action=ReceiveMessage&QueueUrl=${encodeURIComponent(url)}`);
    const handle = got.text.match(/<ReceiptHandle>([^<]+)</)[1];
    await query(base, "sqs", `Action=DeleteMessage&QueueUrl=${encodeURIComponent(url)}&ReceiptHandle=${encodeURIComponent(handle)}`);
    const attributes = await query(base, "sqs", `Action=GetQueueAttributes&QueueUrl=${encodeURIComponent(url)}`);
    assert.match(attributes.text, /ApproximateNumberOfMessages<\/Name><Value>0</);
  });
});

test("SQS answers a queue that is not there rather than making one", async () => {
  await withServer(async ({ base }) => {
    const answered = await query(base, "sqs", `Action=SendMessage&QueueUrl=${encodeURIComponent("http://x/000000000000/ghost")}&MessageBody=x`);
    assert.equal(answered.status, 400);
    assert.match(answered.text, /NonExistentQueue/);
  });
});

// --- Lambda --------------------------------------------------------------

const HANDLER_ZIP = () => createZip([
  { name: "index.js", data: "exports.handler = async (event) => ({ doubled: (event.n || 0) * 2, from: process.env.WHO || 'nobody' });\n" }
]).toString("base64");

async function makeFunction(base, overrides = {}) {
  return call(base, "/2015-03-31/functions/", {
    method: "POST",
    headers: signed("lambda", { "content-type": "application/json" }),
    body: JSON.stringify({
      FunctionName: "doubler",
      Runtime: "nodejs22.x",
      Handler: "index.handler",
      Role: "arn:aws:iam::000000000000:role/lambda",
      Code: { ZipFile: HANDLER_ZIP() },
      ...overrides
    })
  });
}

test("Lambda runs the handler and returns what it returned", async () => {
  await withServer(async ({ base }) => {
    assert.equal((await makeFunction(base)).status, 201);
    const invoked = await call(base, "/2015-03-31/functions/doubler/invocations", {
      method: "POST",
      headers: signed("lambda", { "content-type": "application/json" }),
      body: JSON.stringify({ n: 21 })
    });
    assert.equal(invoked.status, 200);
    assert.deepEqual(JSON.parse(invoked.text), { doubled: 42, from: "nobody" });
  });
});

test("Lambda gives the handler its environment", async () => {
  await withServer(async ({ base }) => {
    await makeFunction(base, { Environment: { Variables: { WHO: "the-emulator" } } });
    const invoked = await call(base, "/2015-03-31/functions/doubler/invocations", {
      method: "POST", headers: signed("lambda", { "content-type": "application/json" }), body: "{}"
    });
    assert.equal(JSON.parse(invoked.text).from, "the-emulator");
  });
});

test("Lambda reports a throwing handler the way Lambda does", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/2015-03-31/functions/", {
      method: "POST",
      headers: signed("lambda", { "content-type": "application/json" }),
      body: JSON.stringify({
        FunctionName: "thrower", Runtime: "nodejs22.x", Handler: "index.handler",
        Code: { ZipFile: createZip([{ name: "index.js", data: "exports.handler=async()=>{throw new Error('deliberate');};" }]).toString("base64") }
      })
    });
    const invoked = await call(base, "/2015-03-31/functions/thrower/invocations", {
      method: "POST", headers: signed("lambda", { "content-type": "application/json" }), body: "{}"
    });
    // 200 with X-Amz-Function-Error: the *invocation* succeeded. A 500 makes
    // every SDK retry, and the retries look like a flaky function.
    assert.equal(invoked.status, 200, "a throwing handler answered non-200, which makes SDKs retry");
    assert.equal(invoked.headers.get("x-amz-function-error"), "Unhandled");
    assert.match(JSON.parse(invoked.text).errorMessage, /deliberate/);
  });
});

test("Lambda stops a handler that runs past its timeout, and says that is what happened", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/2015-03-31/functions/", {
      method: "POST",
      headers: signed("lambda", { "content-type": "application/json" }),
      body: JSON.stringify({
        FunctionName: "slow", Runtime: "nodejs22.x", Handler: "index.handler", Timeout: 1,
        Code: { ZipFile: createZip([{ name: "index.js", data: "exports.handler=async()=>{await new Promise(r=>setTimeout(r,10000));return 1;};" }]).toString("base64") }
      })
    });
    const invoked = await call(base, "/2015-03-31/functions/slow/invocations", {
      method: "POST", headers: signed("lambda", { "content-type": "application/json" }), body: "{}"
    });
    const body = JSON.parse(invoked.text);
    // Its own outcome, not a crash: "killed at 1s" and "threw" send somebody to
    // different places.
    assert.equal(body.errorType, "Sandbox.Timedout");
    assert.match(body.errorMessage, /longer than its 1s timeout/);
  });
});

test("Lambda refuses a runtime it cannot run, at create time", async () => {
  await withServer(async ({ base }) => {
    const refused = await makeFunction(base, { FunctionName: "py", Runtime: "python3.12" });
    assert.equal(refused.status, 400, "a Python function was accepted and would have failed only when invoked");
    assert.match(JSON.parse(refused.text).message, /Node functions only/);
  });
});

test("Lambda says when the handler names an export that is not there", async () => {
  await withServer(async ({ base }) => {
    await makeFunction(base, { FunctionName: "typo", Handler: "index.hndler" });
    const invoked = await call(base, "/2015-03-31/functions/typo/invocations", {
      method: "POST", headers: signed("lambda", { "content-type": "application/json" }), body: "{}"
    });
    const body = JSON.parse(invoked.text);
    assert.equal(body.errorType, "Runtime.HandlerNotFound");
    assert.ok(Array.isArray(body.exports), "the error does not say what the file does export");
  });
});

// --- STS and IAM ---------------------------------------------------------

test("STS answers who the caller is, echoing the key they signed with", async () => {
  await withServer(async ({ base }) => {
    const answered = await query(base, "sts", "Action=GetCallerIdentity&Version=2011-06-15");
    assert.equal(answered.status, 200);
    assert.match(answered.text, /<Account>000000000000<\/Account>/);
    assert.match(answered.text, /user\/test/, "the identity does not reflect the key that was used");
  });
});

test("IAM stores a role and hands it back", async () => {
  await withServer(async ({ base }) => {
    const made = await query(base, "iam", "Action=CreateRole&RoleName=deployer&AssumeRolePolicyDocument=%7B%7D");
    assert.equal(made.status, 200);
    assert.match(made.text, /arn:aws:iam::000000000000:role\/deployer/);
    const got = await query(base, "iam", "Action=GetRole&RoleName=deployer");
    assert.match(got.text, /deployer/);
  });
});

test("IAM refuses to simulate a policy rather than answering allowed", async () => {
  await withServer(async ({ base }) => {
    // Somebody calling this is asking "would AWS allow it". Answering
    // "allowed" without evaluating anything answers a question nobody asked.
    const refused = await query(base, "iam", "Action=SimulatePrincipalPolicy&PolicySourceArn=x");
    assert.equal(refused.status, 400);
    assert.match(refused.text, /does not evaluate IAM policies/);
    assert.match(refused.text, /can still be denied by AWS/);
  });
});

// --- state ---------------------------------------------------------------

test("keeps regions apart, as AWS does", async () => {
  await withServer(async ({ base }) => {
    const inIreland = { authorization: "AWS4-HMAC-SHA256 Credential=test/20260826/eu-west-1/s3/aws4_request, SignedHeaders=host, Signature=x" };
    const inVirginia = { authorization: "AWS4-HMAC-SHA256 Credential=test/20260826/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=x" };
    await call(base, "/regional", { method: "PUT", headers: inIreland });
    const elsewhere = await call(base, "/regional/a.txt", { headers: inVirginia });
    assert.match(elsewhere.text, /NoSuchBucket/,
      "a bucket in one region was visible in another, so a test could pass locally and fail in production");
  });
});

test("resets on request, so a suite does not have to restart the container", async () => {
  await withServer(async ({ base }) => {
    await call(base, "/temporary", { method: "PUT", headers: signed("s3") });
    await call(base, "/_emulator/reset", { method: "POST" });
    const gone = await call(base, "/temporary/x", { headers: signed("s3") });
    assert.match(gone.text, /NoSuchBucket/);
  });
});

test("persists across restarts when a state directory is set, and only then", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aws-emulator-state-"));
  try {
    const first = new Store({ directory });
    const serverOne = createServer({ store: first, quiet: true });
    await new Promise((resolve) => serverOne.listen(0, "127.0.0.1", resolve));
    const baseOne = `http://127.0.0.1:${serverOne.address().port}`;
    await call(baseOne, "/kept", { method: "PUT", headers: signed("s3") });
    await call(baseOne, "/kept/a.txt", { method: "PUT", headers: signed("s3"), body: "still here" });
    await new Promise((resolve) => serverOne.close(resolve));

    const second = new Store({ directory });
    const serverTwo = createServer({ store: second, quiet: true });
    await new Promise((resolve) => serverTwo.listen(0, "127.0.0.1", resolve));
    const baseTwo = `http://127.0.0.1:${serverTwo.address().port}`;
    const back = await call(baseTwo, "/kept/a.txt", { headers: signed("s3") });
    // Bytes, not `[object Object]`. A Buffer through JSON.stringify becomes an
    // object, and the failure shows up as a corrupted download rather than an
    // error.
    assert.equal(back.text, "still here", "the object did not survive a restart intact");
    await new Promise((resolve) => serverTwo.close(resolve));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("does not persist when no state directory is set", async () => {
  await withServer(async ({ store }) => {
    assert.equal(store.directory, null, "an in-memory emulator was quietly writing state to disk");
  });
});

test("answers rather than hanging when a handler throws", async () => {
  await withServer(async ({ base }) => {
    // A body that is not JSON, to a JSON service. The worst outcome is a
    // request that never completes, which is the hardest thing to debug from
    // the other end.
    const answered = await call(base, "/", {
      method: "POST",
      headers: signed("dynamodb", { "x-amz-target": "DynamoDB_20120810.GetItem", "content-type": "application/x-amz-json-1.0" }),
      body: "not json at all"
    });
    assert.ok(answered.status >= 400, "a malformed body answered 2xx");
    assert.match(answered.text, /SerializationException/);
  });
});
