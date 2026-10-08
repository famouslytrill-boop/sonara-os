"use strict";
const assert = require("node:assert/strict");
const { parseSignedRecoveryTransport } = require("../lib/sonara-signed-recovery-transport.cjs");
const BODY = Buffer.from('{"test":"sensor"}', "utf8");
const VALID = [
  "x-sonara-sensor-id", "sensor-A",
  "x-sonara-timestamp-ms", "1800000000000",
  "x-sonara-nonce", "a".repeat(32),
  "x-sonara-signature", "b".repeat(64)
];
describe("SONARA raw-header signed monitor transport", () => {
  it("parses a valid bounded transport without changing body bytes", () => {
    const result = parseSignedRecoveryTransport(BODY, [...VALID]);
    assert.equal(result.ok, true);
    assert.equal(result.envelope.sensorId, "sensor-A");
    assert.equal(result.envelope.timestampMs, 1800000000000);
    assert.deepEqual(result.envelope.rawBody, BODY);
    assert.notEqual(result.envelope.rawBody, BODY);
    assert.equal(Object.isFrozen(result.envelope), true);
  });
  it("rejects duplicate signature headers regardless of casing", () => {
    const result = parseSignedRecoveryTransport(BODY, [...VALID, "X-Sonara-Signature", "c".repeat(64)]);
    assert.equal(result.ok, false);
  });
  it("rejects comma-joined headers, whitespace and CRLF folding", () => {
    for (const changed of [
      "a".repeat(32) + "," + "b".repeat(32),
      "a".repeat(32) + "\r\nInjected: 1",
      "a".repeat(32) + " ",
      "a".repeat(32) + "\t"
    ]) {
      const headers = [...VALID];
      headers[5] = changed;
      assert.equal(parseSignedRecoveryTransport(BODY, headers).ok, false);
    }
  });
  it("fails closed on malformed timestamps and unknown security headers", () => {
    for (const value of ["01800000000000","0","-1","1e12","9999999999999999"]) {
      const headers = [...VALID]; headers[3] = value;
      assert.equal(parseSignedRecoveryTransport(BODY, headers).ok, false);
    }
    assert.equal(parseSignedRecoveryTransport(BODY, [...VALID, "X-Sonara-Algorithm", "md5"]).ok, false);
  });
  it("rejects missing fields, oversized body and invented nonbyte bodies", () => {
    assert.equal(parseSignedRecoveryTransport(BODY, VALID.slice(0,6)).ok, false);
    assert.equal(parseSignedRecoveryTransport(Buffer.alloc(4097), VALID).ok, false);
    assert.equal(parseSignedRecoveryTransport(BODY.toString(), VALID).ok, false);
    assert.equal(parseSignedRecoveryTransport(BODY, ["x-sonara-sensor-id"]).ok, false);
  });
  it("does not accept a normalized headers object that hid duplicates", () => {
    assert.equal(parseSignedRecoveryTransport(BODY, {
      "x-sonara-sensor-id":"sensor-A",
      "x-sonara-signature":"b".repeat(64)
    }).ok, false);
  });
});
