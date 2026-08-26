"use strict";

// Where the emulated state lives.
//
// In memory, and optionally mirrored to disk. Both halves matter for different
// reasons, and the default is the one that surprises nobody.
//
// **In memory by default.** A test suite wants a clean account every run. An
// emulator that quietly kept last week's buckets would make tests pass because
// of state nobody could see, which is the single most annoying way for a test
// to be wrong.
//
// **Persisted when asked.** Somebody developing against it all day does not
// want to re-seed a DynamoDB table every time the container restarts. Setting
// `AWS_EMULATOR_STATE_DIR` turns it on, and it says so at startup rather than
// doing it silently.
//
// ## Regions and accounts are kept apart even though nobody asks for that
//
// Every key here is scoped by account and region. Real AWS keeps a bucket in
// eu-west-1 separate from one in us-east-1, and an emulator that flattens them
// lets a test pass locally and fail in production for a reason the test could
// never have shown. It costs one map key to be right.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ACCOUNT = "000000000000";

class Store {
  constructor({ directory = null, account = DEFAULT_ACCOUNT } = {}) {
    this.account = account;
    this.directory = directory || null;
    this.data = new Map();
    if (this.directory) this.load();
  }

  // account:region:service:kind -> a Map or an array
  key(parts) {
    return parts.map((part) => String(part)).join(":");
  }

  scope(region, service, kind) {
    const key = this.key([this.account, region || "us-east-1", service, kind]);
    if (!this.data.has(key)) this.data.set(key, new Map());
    return this.data.get(key);
  }

  // Everything, for a reset. Used by the tests and by the `/_emulator/reset`
  // endpoint, which exists so a test suite does not have to restart a container
  // between cases.
  clear() {
    this.data.clear();
    if (this.directory) this.save();
  }

  counts() {
    const out = {};
    for (const [key, value] of this.data) {
      if (value.size > 0) out[key] = value.size;
    }
    return out;
  }

  // --- persistence ------------------------------------------------------
  //
  // JSON with Buffers written as base64, because an S3 object is bytes and
  // `JSON.stringify` turns a Buffer into `{type:"Buffer",data:[...]}` -- which
  // round-trips as an object rather than as bytes, and the failure shows up as
  // a corrupted download rather than as an error.

  serialise(value) {
    if (Buffer.isBuffer(value)) return { __bytes: value.toString("base64") };
    if (value instanceof Map) return { __map: [...value].map(([k, v]) => [k, this.serialise(v)]) };
    if (Array.isArray(value)) return value.map((entry) => this.serialise(entry));
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = this.serialise(v);
      return out;
    }
    return value;
  }

  revive(value) {
    if (value && typeof value === "object") {
      if (typeof value.__bytes === "string") return Buffer.from(value.__bytes, "base64");
      if (Array.isArray(value.__map)) return new Map(value.__map.map(([k, v]) => [k, this.revive(v)]));
      if (Array.isArray(value)) return value.map((entry) => this.revive(entry));
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = this.revive(v);
      return out;
    }
    return value;
  }

  file() {
    return path.join(this.directory, "state.json");
  }

  save() {
    if (!this.directory) return;
    fs.mkdirSync(this.directory, { recursive: true });
    const out = {};
    for (const [key, value] of this.data) out[key] = this.serialise(value);
    fs.writeFileSync(this.file(), JSON.stringify(out));
  }

  load() {
    let raw;
    try {
      raw = fs.readFileSync(this.file(), "utf8");
    } catch {
      // No file yet is the normal first run, not a failure.
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      for (const [key, value] of Object.entries(parsed)) this.data.set(key, this.revive(value));
    } catch (error) {
      // Loud, and then empty. A corrupt state file that silently starts an
      // empty account is an emulator that lost somebody's work without saying
      // so -- and they would go looking for the bug in their own code.
      process.stderr.write(`aws-emulator: could not read ${this.file()}, starting empty: ${error.message}\n`);
    }
  }
}

module.exports = { Store, DEFAULT_ACCOUNT };
