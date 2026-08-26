"use strict";

// Where credentials come from, and the two mistakes worth preventing.
//
// **Expired must not read as forbidden.** An expired session key fails as a 403
// that looks exactly like a missing permission, which sends people to IAM to
// debug something that is not broken.
//
// **Absent must not read as expired.** `new Date(null)` is the epoch, so a
// credential set with no expiry recorded would be "expired in 1970" and every
// static key would be rejected.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  resolveCredentials, saveToCache, fromEnvironment, fromSharedFile,
  isExpired, NoCredentials
} = require("../src/credentials.js");

test("reads credentials from the environment", () => {
  const found = fromEnvironment({
    AWS_ACCESS_KEY_ID: "AK", AWS_SECRET_ACCESS_KEY: "SK", AWS_SESSION_TOKEN: "ST"
  });
  assert.equal(found.accessKeyId, "AK");
  assert.equal(found.sessionToken, "ST");
});

test("ignores a half-set environment rather than building a broken credential", () => {
  assert.equal(fromEnvironment({ AWS_ACCESS_KEY_ID: "AK" }), null,
    "an access key with no secret was returned, and would fail later as a signing error");
});

test("treats a credential with no expiry as long-lived, not as expired in 1970", () => {
  assert.equal(isExpired(null), false);
  assert.equal(isExpired(undefined), false);
  assert.equal(isExpired(""), false);
});

test("treats an unparseable expiry as long-lived rather than guessing", () => {
  assert.equal(isExpired("not a date"), false);
});

test("counts a credential expiring within five minutes as expired", () => {
  const now = Date.now();
  assert.equal(isExpired(new Date(now + 60 * 1000).toISOString(), now), true,
    "a credential expiring in one minute was accepted, and would expire mid-deploy");
  assert.equal(isExpired(new Date(now + 60 * 60 * 1000).toISOString(), now), false);
});

test("says expired rather than letting AWS report it as a permissions problem", () => {
  const expired = () => ({
    source: "the test", accessKeyId: "AK", secretAccessKey: "SK",
    expiresAt: new Date(Date.now() - 1000).toISOString()
  });
  try {
    resolveCredentials({ sources: [expired] });
    assert.fail("expired credentials were used");
  } catch (error) {
    assert.ok(error instanceof NoCredentials);
    assert.match(error.message, /expired at/);
    assert.match(error.hint, /not a permissions problem/);
  }
});

test("prefers the environment over everything else, as every AWS tool does", () => {
  const found = resolveCredentials({
    sources: [
      () => ({ source: "the environment", accessKeyId: "ENV", secretAccessKey: "S" }),
      () => ({ source: "a file", accessKeyId: "FILE", secretAccessKey: "S" })
    ]
  });
  assert.equal(found.accessKeyId, "ENV");
});

test("falls through an expired source to a usable one", () => {
  const found = resolveCredentials({
    sources: [
      () => ({ source: "cache", accessKeyId: "OLD", secretAccessKey: "S", expiresAt: new Date(Date.now() - 1).toISOString() }),
      () => ({ source: "file", accessKeyId: "GOOD", secretAccessKey: "S" })
    ]
  });
  assert.equal(found.accessKeyId, "GOOD");
});

test("names every place it looked when there is nothing anywhere", () => {
  try {
    resolveCredentials({ sources: [() => null, () => null] });
    assert.fail("resolveCredentials invented a credential");
  } catch (error) {
    assert.match(error.message, /No AWS credentials were found/);
    assert.match(error.hint, /sonara-serverless login/);
    assert.match(error.hint, /Looked in:/);
  }
});

test("reads a profile out of ~/.aws/credentials", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-creds-"));
  try {
    const file = path.join(dir, "credentials");
    fs.writeFileSync(file, [
      "[default]",
      "aws_access_key_id = DEFAULTKEY",
      "aws_secret_access_key = defaultsecret",
      "",
      "; a comment",
      "[work]",
      "aws_access_key_id = WORKKEY",
      "aws_secret_access_key = worksecret",
      "aws_session_token = worktoken"
    ].join("\n"));

    assert.equal(fromSharedFile({ file }).accessKeyId, "DEFAULTKEY");
    const work = fromSharedFile({ file, profile: "work" });
    assert.equal(work.accessKeyId, "WORKKEY");
    assert.equal(work.sessionToken, "worktoken");
    assert.equal(fromSharedFile({ file, profile: "nope" }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("returns nothing rather than throwing when the shared file is not there", () => {
  assert.equal(fromSharedFile({ file: "/nonexistent/path/credentials" }), null);
});

test("writes the cache readable only by its owner", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-creds-"));
  try {
    const file = path.join(dir, "credentials.json");
    saveToCache("default", { accessKeyId: "AK", secretAccessKey: "SK" }, { file });
    const mode = fs.statSync(file).mode & 0o777;
    assert.equal(mode, 0o600, `the credential cache is mode ${mode.toString(8)}, so other users on this machine can read the key`);
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).default.accessKeyId, "AK");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps other profiles when one is written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-creds-"));
  try {
    const file = path.join(dir, "credentials.json");
    saveToCache("work", { accessKeyId: "W", secretAccessKey: "S" }, { file });
    saveToCache("home", { accessKeyId: "H", secretAccessKey: "S" }, { file });
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.work.accessKeyId, "W", "writing one profile discarded another");
    assert.equal(saved.home.accessKeyId, "H");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
