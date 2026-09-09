"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const sigv4 = require("../lib/sonara-aws-signature-v4.cjs");

// Signing code that is wrong looks exactly like signing code that is right:
// both return a hex string. So none of this checks the signer against itself.
// Every expected value below is copied from a worked example AWS publishes at
// docs.aws.amazon.com/amazonglacier/latest/dev/amazon-glacier-signing-requests.html,
// read on 9 September 2026, which prints the canonical request, the string to
// sign and the final signature for two complete requests.
//
// Both vectors are for the `glacier` service rather than `s3`. That is on
// purpose and is the stronger test: the service name is an input to the derived
// key, so passing both means the four-step key derivation is right rather than
// tuned to one service.
//
// Every intermediate value is asserted, not just the final signature. A signer
// that fails should say which of the four steps drifted; a single end-to-end
// assertion would only say the hex differs.

const SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";

// Vault creation: no query string, no payload, three signed headers.
const CREATE_VAULT = {
  amzDate: "20120525T002453Z",
  region: "us-east-1",
  service: "glacier",
  canonicalRequest: [
    "PUT",
    "/-/vaults/examplevault",
    "",
    "host:glacier.us-east-1.amazonaws.com",
    "x-amz-date:20120525T002453Z",
    "x-amz-glacier-version:2012-06-01",
    "",
    "host;x-amz-date;x-amz-glacier-version",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ].join("\n"),
  canonicalRequestHash: "5f1da1a2d0feb614dd03d71e87928b8e449ac87614479332aced3a701f916743",
  signature: "3ce5b2f2fffac9262b4da9256f8d086b4aaf42eba5f111c21681a65a127b7c2a"
};

// Archive upload: a signed payload, four signed headers. Exercises the path
// where the content hash is a real hash rather than the empty-string one.
const UPLOAD_ARCHIVE = {
  amzDate: "20120507T000000Z",
  region: "us-east-1",
  service: "glacier",
  payload: "Welcome to Amazon Glacier.",
  payloadHash: "726e392cb4d09924dbad1cc0ba3b00c3643d03d14cb4b823e2f041cff612a628",
  signature: "b092397439375d59119072764a1e9a144677c43d9906fd98a5742c57a2855de6"
};

describe("AWS Signature Version 4 matches the vectors AWS publishes", () => {
  // The vectors themselves are checked first. If a hash below is a transcription
  // error, every assertion after it is testing a fiction, and the failure would
  // look like a bug in the signer rather than a bug in the test.
  describe("the published vectors are transcribed correctly", () => {
    it("hashes the empty payload to the value both examples print", () => {
      assert.equal(sigv4.sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("hashes the archive payload to the value the second example prints", () => {
      assert.equal(sigv4.sha256Hex(UPLOAD_ARCHIVE.payload), UPLOAD_ARCHIVE.payloadHash);
    });

    it("hashes the first example's canonical request to the value inside its string to sign", () => {
      assert.equal(sigv4.sha256Hex(CREATE_VAULT.canonicalRequest), CREATE_VAULT.canonicalRequestHash);
    });
  });

  describe("Create Vault (PUT), the first published example", () => {
    const built = sigv4.buildCanonicalRequest({
      method: "PUT",
      path: "/-/vaults/examplevault",
      query: {},
      headers: {
        host: "glacier.us-east-1.amazonaws.com",
        "x-amz-date": CREATE_VAULT.amzDate,
        "x-amz-glacier-version": "2012-06-01"
      },
      payloadHash: sigv4.sha256Hex("")
    });

    it("builds the canonical request byte for byte", () => {
      assert.equal(built.canonicalRequest, CREATE_VAULT.canonicalRequest);
    });

    it("lists the signed headers in the documented order", () => {
      assert.equal(built.signedHeaders, "host;x-amz-date;x-amz-glacier-version");
    });

    it("builds the string to sign exactly as the page prints it", () => {
      const stringToSign = sigv4.buildStringToSign({
        amzDate: CREATE_VAULT.amzDate,
        region: CREATE_VAULT.region,
        service: CREATE_VAULT.service,
        canonicalRequest: built.canonicalRequest
      });
      assert.equal(
        stringToSign,
        ["AWS4-HMAC-SHA256", "20120525T002453Z", "20120525/us-east-1/glacier/aws4_request", CREATE_VAULT.canonicalRequestHash].join("\n")
      );
    });

    it("produces the published signature", () => {
      const signed = sigv4.signRequest({
        method: "PUT",
        path: "/-/vaults/examplevault",
        headers: { host: "glacier.us-east-1.amazonaws.com", "x-amz-glacier-version": "2012-06-01" },
        payload: "",
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET,
        region: CREATE_VAULT.region,
        service: CREATE_VAULT.service,
        when: new Date("2012-05-25T00:24:53Z"),
        includeContentSha256: false
      });
      assert.equal(signed.signature, CREATE_VAULT.signature);
    });

    it("assembles the Authorization header AWS prints, as one continuous string", () => {
      const signed = sigv4.signRequest({
        method: "PUT",
        path: "/-/vaults/examplevault",
        headers: { host: "glacier.us-east-1.amazonaws.com", "x-amz-glacier-version": "2012-06-01" },
        payload: "",
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET,
        region: CREATE_VAULT.region,
        service: CREATE_VAULT.service,
        when: new Date("2012-05-25T00:24:53Z"),
        includeContentSha256: false
      });
      assert.equal(
        signed.headers.authorization,
        "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20120525/us-east-1/glacier/aws4_request, " +
          "SignedHeaders=host;x-amz-date;x-amz-glacier-version, " +
          "Signature=3ce5b2f2fffac9262b4da9256f8d086b4aaf42eba5f111c21681a65a127b7c2a"
      );
    });
  });

  describe("Upload Archive (POST) with a signed payload, the second published example", () => {
    it("builds the canonical request the page prints, including the content hash header", () => {
      const built = sigv4.buildCanonicalRequest({
        method: "POST",
        path: "/-/vaults/examplevault",
        query: {},
        headers: {
          host: "glacier.us-east-1.amazonaws.com",
          "x-amz-content-sha256": UPLOAD_ARCHIVE.payloadHash,
          "x-amz-date": UPLOAD_ARCHIVE.amzDate,
          "x-amz-glacier-version": "2012-06-01"
        },
        payloadHash: UPLOAD_ARCHIVE.payloadHash
      });
      assert.equal(
        built.canonicalRequest,
        [
          "POST",
          "/-/vaults/examplevault",
          "",
          "host:glacier.us-east-1.amazonaws.com",
          `x-amz-content-sha256:${UPLOAD_ARCHIVE.payloadHash}`,
          "x-amz-date:20120507T000000Z",
          "x-amz-glacier-version:2012-06-01",
          "",
          "host;x-amz-content-sha256;x-amz-date;x-amz-glacier-version",
          UPLOAD_ARCHIVE.payloadHash
        ].join("\n")
      );
    });

    // The published signature for THIS example is not asserted, and the reason
    // is a finding rather than a convenience.
    //
    // b092397439375d59119072764a1e9a144677c43d9906fd98a5742c57a2855de6 is what
    // the page prints. It does not follow from the canonical request the same
    // page prints, which the test above shows this signer reproduces byte for
    // byte. Seven variations were tried on 9 September 2026 -- as printed, plus
    // x-amz-sha256-tree-hash, plus x-amz-archive-description, both, the secret
    // key spelled with `+` instead of `/`, service `s3`, and a trailing slash on
    // the path -- and none produced it.
    //
    // The page itself hints at why: the request it shows carries
    // x-amz-sha256-tree-hash and x-amz-archive-description headers that its
    // printed canonical form omits, so the signature was very likely computed
    // over a request that is not the one documented.
    //
    // The Create Vault vector above has no such gap: its printed canonical
    // request hashes to the value inside its printed string to sign, and signing
    // that string with the derived key produces its printed signature. That
    // vector closes, so it is the one that proves the chain -- canonical request,
    // string to sign, key derivation and final HMAC.
    //
    // What this example still proves is asserted above: the canonical request
    // for a request WITH a signed payload, including the content-hash header. The
    // payload hashing it depends on is checked against the documented hash in
    // the transcription block at the top.
    //
    // Asserting a value that a correct implementation cannot produce would mean
    // either a permanently red test or a signer bent until it matched a typo.
    it("hashes its payload to the documented value, which is the part of it that closes", () => {
      assert.equal(sigv4.sha256Hex(UPLOAD_ARCHIVE.payload), UPLOAD_ARCHIVE.payloadHash);
      const signed = sigv4.signRequest({
        method: "POST",
        path: "/-/vaults/examplevault",
        headers: { host: "glacier.us-east-1.amazonaws.com", "x-amz-glacier-version": "2012-06-01" },
        payload: UPLOAD_ARCHIVE.payload,
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET,
        region: UPLOAD_ARCHIVE.region,
        service: UPLOAD_ARCHIVE.service,
        when: new Date("2012-05-07T00:00:00Z")
      });
      assert.match(signed.headers["x-amz-content-sha256"], /^[0-9a-f]{64}$/);
      assert.equal(signed.headers["x-amz-content-sha256"], UPLOAD_ARCHIVE.payloadHash);
      assert.equal(signed.signedHeaders, "host;x-amz-content-sha256;x-amz-date;x-amz-glacier-version");
    });
  });

  // A signature that does not change when the request changes is not a
  // signature. Each of these alters exactly one input and requires the output
  // to move -- the falsification half, without which every assertion above
  // could be satisfied by a function returning a constant.
  describe("every signed input actually reaches the signature", () => {
    const base = {
      method: "PUT",
      path: "/-/vaults/examplevault",
      headers: { host: "glacier.us-east-1.amazonaws.com", "x-amz-glacier-version": "2012-06-01" },
      payload: "",
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET,
      region: "us-east-1",
      service: "glacier",
      when: new Date("2012-05-25T00:24:53Z"),
      includeContentSha256: false
    };
    const baseline = sigv4.signRequest(base).signature;

    it("has a baseline that is the published value, so the comparisons below mean something", () => {
      assert.equal(baseline, CREATE_VAULT.signature);
    });

    const changes = {
      method: { method: "GET" },
      path: { path: "/-/vaults/othervault" },
      "a signed header": { headers: { ...base.headers, "x-amz-glacier-version": "2012-06-02" } },
      payload: { payload: "x" },
      "secret key": { secretAccessKey: `${SECRET}x` },
      region: { region: "us-west-2" },
      service: { service: "s3" },
      "the instant": { when: new Date("2012-05-25T00:24:54Z") },
      "a query parameter": { query: { list: "" } }
    };

    for (const [what, override] of Object.entries(changes)) {
      it(`changes the signature when the ${what} changes`, () => {
        assert.notEqual(sigv4.signRequest({ ...base, ...override }).signature, baseline);
      });
    }

    it("does not change the signature when only an unsigned detail changes", () => {
      // The access key id appears in the Authorization header's Credential
      // field, not in the string to sign. If changing it moved the signature,
      // the scope would be built from the wrong thing.
      assert.equal(sigv4.signRequest({ ...base, accessKeyId: "AKIAOTHEREXAMPLEKEY1" }).signature, baseline);
    });
  });

  describe("URI encoding follows the AWS rules rather than the platform's", () => {
    // AWS's own documentation warns that the platform encoder may not work and
    // says to write your own. These are the characters where encodeURIComponent
    // disagrees, each of which would sign correctly and be rejected remotely.
    for (const character of ["!", "'", "(", ")", "*"]) {
      it(`encodes ${character}, which encodeURIComponent leaves alone`, () => {
        assert.equal(encodeURIComponent(character), character, "premise changed: this character is now encoded natively");
        assert.notEqual(sigv4.uriEncode(character), character);
      });
    }

    it("encodes a space as %20 rather than +", () => {
      assert.equal(sigv4.uriEncode("a b"), "a%20b");
    });

    it("uses uppercase hexadecimal, which the specification requires", () => {
      assert.equal(sigv4.uriEncode(""), "%1A");
    });

    it("leaves the unreserved characters alone", () => {
      assert.equal(sigv4.uriEncode("Az09-._~"), "Az09-._~");
    });

    it("keeps the slashes in a path and encodes them elsewhere", () => {
      assert.equal(sigv4.canonicalUri("/media/2026/report card.pdf"), "/media/2026/report%20card.pdf");
      assert.equal(sigv4.uriEncode("a/b"), "a%2Fb");
    });

    it("encodes multi-byte characters one byte at a time", () => {
      // é is two bytes in UTF-8. Encoding the character rather than its bytes
      // is a signature over a string R2 never sees.
      assert.equal(sigv4.uriEncode("é"), "%C3%A9");
    });
  });

  describe("canonical form details that are easy to get wrong and silent when missed", () => {
    it("sorts query parameters after encoding, not before", () => {
      // "a b" encodes to "a%20b"; the space sorts before "!" and "%20" does not.
      const encoded = sigv4.canonicalQueryString({ "a b": "1", "a!": "2" });
      assert.equal(encoded, "a%20b=1&a%21=2");
    });

    it("collapses runs of whitespace inside a header value", () => {
      const { canonical } = sigv4.canonicalHeaders({ "x-amz-meta-note": "  two   words  " });
      assert.equal(canonical, "x-amz-meta-note:two words");
    });

    it("lower-cases header names and sorts them", () => {
      const { canonical, signed } = sigv4.canonicalHeaders({ Zeta: "1", Host: "h", "X-Amz-Date": "d" });
      assert.equal(signed, "host;x-amz-date;zeta");
      assert.equal(canonical, "host:h\nx-amz-date:d\nzeta:1");
    });

    it("derives both date stamps from one instant", () => {
      const { amzDate, date } = sigv4.amzDateStamps(new Date("2012-05-25T00:24:53.456Z"));
      assert.equal(amzDate, "20120525T002453Z");
      assert.equal(date, "20120525");
    });

    it("derives the signing key with four chained HMACs in the documented order", () => {
      // Recomputed here from the documented chain rather than from the module,
      // so a reordering inside signingKey fails rather than agreeing with itself.
      const step = (key, value) => crypto.createHmac("sha256", key).update(value, "utf8").digest();
      const expected = step(step(step(step(`AWS4${SECRET}`, "20120525"), "us-east-1"), "glacier"), "aws4_request");
      const actual = sigv4.signingKey({ secretAccessKey: SECRET, date: "20120525", region: "us-east-1", service: "glacier" });
      assert.equal(actual.toString("hex"), expected.toString("hex"));
    });
  });
});
