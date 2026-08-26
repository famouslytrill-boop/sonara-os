"use strict";

// The signer, checked against somebody else's answers.
//
// A signature has no readable output: 64 hex characters, and a wrong one looks
// exactly like a right one. The only natural feedback is a 403 from AWS, which
// also means expired credentials, clock skew, a missing permission and several
// other things. Testing this against itself would prove nothing.
//
// The vectors below are copied from the AWS SDK for PHP's own SignatureV4 test
// suite -- an implementation AWS ships and tests. They are quoted verbatim,
// signature strings included, and this signer has to produce those exact bytes.
//
// Two things worth recording about how these were obtained. A summarised copy
// of the same file silently dropped one header from the first vector, which
// made a correct signer look broken; the raw file had to be read to get the
// real input. And the fourth vector -- a path containing a space -- caught a
// genuine bug: the signer was applying S3's single-encoding rule to every
// service, where AWS double-encodes the path everywhere except S3.

const test = require("node:test");
const assert = require("node:assert/strict");

const { sign, canonicalPath, canonicalQuery, amzDate } = require("../src/sigv4.js");

const KEY = "AKIDEXAMPLE";
const SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";
const WHEN = new Date(Date.UTC(2011, 8, 9, 23, 36, 0));

// aws/aws-sdk-php, tests/Signature/SignatureV4Test.php -- provider().
const VECTORS = Object.freeze([
  {
    label: "POST with an extra header",
    method: "POST",
    path: "/",
    headers: { ZOO: "zoobar" },
    signedHeaders: "host;x-amz-date;zoo",
    signature: "b28a4d452e58edf8ff150a9518b6f4135c9960e4724dc3daab4d7ccc26e90b9b"
  },
  {
    label: "the same request as a GET signs differently",
    method: "GET",
    path: "/",
    headers: { ZOO: "zoobar" },
    signedHeaders: "host;x-amz-date;zoo",
    signature: "287deb2c1249c9c415cb4b3ef74404629fcab56a8e9ec568bff88cf093196e8e"
  },
  {
    label: "a repeated header's values are sorted",
    method: "POST",
    path: "/",
    headers: { p: "a,a,p,z" },
    signedHeaders: "host;p;x-amz-date",
    signature: "faca06aa6ae71c0a24116c9a61b01346e6d9d621001bac49d38a6fdb285649ec"
  },
  {
    label: "a path containing a space is encoded twice",
    method: "GET",
    path: "/%20/foo",
    headers: {},
    signedHeaders: "host;x-amz-date",
    signature: "948b2292a8bcb4510013741d64c5667f75d46dd6c4896ead5d669eb8264ebe1f"
  }
]);

// The published vectors sign host, x-amz-date and the request's own headers,
// and nothing else. Production always adds x-amz-content-sha256, which changes
// the signature -- so the comparison turns that one header off. Everything
// else is the real function on the real code path.
function signVector(vector) {
  return sign({
    method: vector.method,
    host: "host.foo.com",
    path: vector.path,
    headers: vector.headers,
    body: "",
    region: "us-east-1",
    service: "host",
    credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    date: WHEN,
    signContentSha256: false
  });
}

test("this suite has vectors to check, so it cannot pass on an empty list", () => {
  assert.ok(VECTORS.length >= 4, "the vector list is empty or short, so the tests below check nothing");
});

for (const vector of VECTORS) {
  test(`reproduces AWS's published signature: ${vector.label}`, () => {
    const signed = signVector(vector);
    assert.equal(
      signed.signature,
      vector.signature,
      "this signer does not agree with the implementation AWS ships"
    );
    assert.ok(
      signed.headers.authorization.includes(`SignedHeaders=${vector.signedHeaders}`),
      `signed the wrong set of headers: ${signed.headers.authorization}`
    );
    assert.ok(
      signed.headers.authorization.startsWith(`AWS4-HMAC-SHA256 Credential=${KEY}/20110909/us-east-1/host/aws4_request,`),
      "the credential scope is not the one AWS expects"
    );
  });
}

test("double-encodes a path for a normal service and single-encodes for S3", () => {
  const common = {
    method: "GET",
    host: "host.foo.com",
    path: "/%20/foo",
    body: "",
    region: "us-east-1",
    credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    date: WHEN,
    signContentSha256: false
  };
  const normal = sign({ ...common, service: "cloudformation" });
  const s3 = sign({ ...common, service: "s3" });
  assert.ok(normal.canonicalRequest.split("\n")[1] === "/%2520/foo",
    "a non-S3 service did not double-encode the path, which AWS answers with a 403");
  assert.ok(s3.canonicalRequest.split("\n")[1] === "/%20/foo",
    "S3 double-encoded the path, so the signature covers a different key than the request asks for");
});

test("sends x-amz-content-sha256 by default, because S3 requires it", () => {
  const signed = sign({
    method: "PUT", host: "b.s3.amazonaws.com", path: "/k.zip", body: "hello",
    region: "eu-west-1", service: "s3",
    credentials: { accessKeyId: KEY, secretAccessKey: SECRET }, date: WHEN
  });
  assert.equal(signed.headers["x-amz-content-sha256"],
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    "the payload hash header is missing or is not the hash of the body");
  assert.match(signed.headers.authorization, /x-amz-content-sha256/,
    "the header was sent but not signed");
});

test("puts the timestamp in the header and formats it from UTC", () => {
  assert.equal(amzDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5))), "20260102T030405Z");
  assert.equal(signVector(VECTORS[0]).headers["x-amz-date"], "20110909T233600Z");
});

test("signs a session token rather than sending one it did not sign", () => {
  const signed = sign({
    host: "h.example.com", region: "eu-west-1", service: "cloudformation",
    credentials: { accessKeyId: "A", secretAccessKey: "B", sessionToken: "TOKEN" }
  });
  assert.equal(signed.headers["x-amz-security-token"], "TOKEN");
  assert.match(signed.headers.authorization, /x-amz-security-token/,
    "the session token was sent but not signed, which AWS answers with a 403 that reads like a wrong secret key");
});

test("sorts query parameters by encoded name", () => {
  assert.equal(canonicalQuery({ b: "2", a: "1", A: "0" }), "A=0&a=1&b=2");
});

test("drops a query parameter that is absent rather than sending it empty", () => {
  assert.equal(canonicalQuery({ a: "1", b: undefined, c: null }), "a=1");
});

test("encodes the characters encodeURIComponent leaves alone", () => {
  // ! ' ( ) * are exactly the ones that differ from RFC 3986, and an S3 key
  // containing an apostrophe is how that is usually discovered.
  assert.equal(canonicalQuery({ k: "it's (a) test!*" }), "k=it%27s%20%28a%29%20test%21%2A");
});

test("leaves the path separators alone while encoding the segments", () => {
  assert.equal(canonicalPath("/my bucket/a+b.zip", { doubleEncode: false }), "/my%20bucket/a%2Bb.zip");
  assert.equal(canonicalPath("/"), "/");
});

test("refuses to sign without credentials rather than producing a signature of nothing", () => {
  assert.throws(() => sign({ host: "h", region: "r", service: "s" }), /credentials/);
  assert.throws(() => sign({ host: "h", region: "r", service: "s", credentials: { accessKeyId: "a" } }), /credentials/);
});
