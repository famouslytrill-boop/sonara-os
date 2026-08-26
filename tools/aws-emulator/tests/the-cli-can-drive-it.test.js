"use strict";

// The serverless CLI, pointed at this emulator.
//
// This is the test that gives both projects something neither had. The CLI in
// `tools/serverless-cli/` builds and signs real AWS requests, and until this
// existed **it had never spoken to a server** -- its README says so in those
// words. Its SigV4 signer was checked against AWS's published vectors, which
// proves the arithmetic and proves nothing about whether the requests it
// assembles are ones a service would accept.
//
// Two projects written independently, one signing and one parsing, agreeing
// over a socket is a far stronger statement than either making sense alone.
//
// It found a real problem on the first run. `createBucket` addresses a bucket
// the way AWS does -- `bucket.s3.region.amazonaws.com` -- and a local endpoint
// is one host with no wildcard DNS in front of it, so the bucket name was
// simply lost and the emulator answered "S3 does not answer PUT at the root".
// That is the problem every emulator user hits, and the fix is the one the SDKs
// call `forcePathStyle`: `AWS_ENDPOINT_URL` now moves the bucket into the path.

const test = require("node:test");
const assert = require("node:assert/strict");

const { createServer } = require("../src/server.js");
const { Store } = require("../src/store.js");

const CREDENTIALS = { accessKeyId: "test", secretAccessKey: "test" };

// The CLI reads `AWS_ENDPOINT_URL` when it builds an address, so the variable
// has to be set before each call rather than at require time. Set and restored
// around the body so one test cannot leak an endpoint into another.
async function withEmulator(run) {
  const server = createServer({ store: new Store(), quiet: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.AWS_ENDPOINT_URL;
  process.env.AWS_ENDPOINT_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    // Required inside, after the variable is set, so this reads it the way a
    // real invocation would.
    const aws = require("../../serverless-cli/src/aws.js");
    return await run({ aws, at: { region: "eu-west-1", credentials: CREDENTIALS } });
  } finally {
    if (previous === undefined) delete process.env.AWS_ENDPOINT_URL;
    else process.env.AWS_ENDPOINT_URL = previous;
    await new Promise((resolve) => server.close(resolve));
  }
}

test("the CLI's signer produces requests this emulator accepts", async () => {
  await withEmulator(async ({ aws, at }) => {
    // Every one of these is signed by the CLI's own SigV4 implementation and
    // routed by the emulator's own credential-scope reader. Neither knows about
    // the other.
    const identity = await aws.callerIdentity(at);
    assert.equal(identity.account, "000000000000");
    assert.match(identity.arn, /user\/test/, "the emulator did not read the key out of the signature the CLI produced");
  });
});

test("the CLI's S3 client works against a single-host endpoint", async () => {
  await withEmulator(async ({ aws, at }) => {
    await aws.createBucket({ ...at, bucket: "deploy-artifacts" });
    await aws.putObject({ ...at, bucket: "deploy-artifacts", key: "app/abc.zip", body: Buffer.from("a deployment package") });

    assert.equal(await aws.objectExists({ ...at, bucket: "deploy-artifacts", key: "app/abc.zip" }), true);
    assert.equal(
      await aws.objectExists({ ...at, bucket: "deploy-artifacts", key: "app/nope.zip" }), false,
      "a key that is not there was reported as present, so a deploy would skip the upload"
    );
  });
});

test("creating the same bucket twice does not fail either deploy", async () => {
  await withEmulator(async ({ aws, at }) => {
    // The CLI relies on this: two deploys racing must not fail one of them.
    // Both sides have to agree, and only a round trip shows that they do.
    await aws.createBucket({ ...at, bucket: "shared-artifacts" });
    assert.equal(await aws.createBucket({ ...at, bucket: "shared-artifacts" }), true);
  });
});

test("an unimplemented service reaches the CLI as an error, not as an empty answer", async () => {
  await withEmulator(async ({ aws, at }) => {
    // The important one. `describeStack` deliberately reads "does not exist" as
    // `exists: false` and everything else as a failure -- its own comment says
    // conflating them "would report an unreachable account as an empty one, and
    // then create a stack that already exists".
    //
    // The emulator refuses CloudFormation by name. So the two behaviours have
    // to meet correctly: a refusal must NOT arrive as a stack that is simply
    // not there.
    await assert.rejects(
      aws.describeStack({ ...at, stackName: "orders-api" }),
      (error) => /not emulated/.test(error.message),
      "an unimplemented service was read as an empty account, which is the failure both projects are written to avoid"
    );
  });
});

test("the address changes shape for an endpoint, and not otherwise", async () => {
  const aws = require("../../serverless-cli/src/aws.js");
  const previous = process.env.AWS_ENDPOINT_URL;
  try {
    delete process.env.AWS_ENDPOINT_URL;
    const real = aws.addressFor("s3", "eu-west-1", { bucket: "b", path: "/k.zip" });
    assert.equal(real.host, "b.s3.eu-west-1.amazonaws.com", "the bucket left the hostname when talking to real AWS");
    assert.equal(real.path, "/k.zip");

    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    const local = aws.addressFor("s3", "eu-west-1", { bucket: "b", path: "/k.zip" });
    assert.equal(local.host, "localhost:4566");
    assert.equal(local.path, "/b/k.zip", "the bucket did not move into the path, so its name is lost against a single host");
    // The signature has to cover the host the request is actually sent to, or
    // every call is a 403 that looks like a credentials problem.
    assert.ok(local.url.startsWith("http://localhost:4566/b/"));
  } finally {
    if (previous === undefined) delete process.env.AWS_ENDPOINT_URL;
    else process.env.AWS_ENDPOINT_URL = previous;
  }
});
