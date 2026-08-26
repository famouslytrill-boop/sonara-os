"use strict";

// The deployment package.
//
// Two properties, and the second is the one that makes the plan worth reading.
//
// It has to be a real ZIP -- checked by handing it to `unzip`, which is an
// implementation this project did not write. A zip verified only by this
// project's own reader would agree with itself about a format it had got wrong.
//
// And it has to be **deterministic**. A ZIP normally stores each file's
// modification time, so the bytes differ on every build, so the checksum
// differs, so CloudFormation reports every function as changed on every deploy.
// A plan that always says "1 function to update" is a plan people stop reading,
// and then the plan is no longer a safety feature.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { createZip, collectFiles, keyFor, isExcluded } = require("../src/bundle.js");

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sonara-bundle-"));
}

test("produces something unzip accepts, with the contents intact", () => {
  const dir = scratch();
  try {
    const zip = createZip([
      { name: "handlers/checkout.js", data: "exports.handler = async () => 1;\n" },
      { name: "package.json", data: '{"type":"commonjs"}\n' }
    ]);
    const zipPath = path.join(dir, "bundle.zip");
    fs.writeFileSync(zipPath, zip);

    // An independent implementation. If this project's idea of the ZIP format
    // is wrong, this is what says so.
    const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
    assert.match(listing, /handlers\/checkout\.js/);
    assert.match(listing, /package\.json/);

    execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
    assert.equal(
      fs.readFileSync(path.join(dir, "out", "handlers", "checkout.js"), "utf8"),
      "exports.handler = async () => 1;\n",
      "the file came back out different from how it went in"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("passes unzip's own integrity check", () => {
  const dir = scratch();
  try {
    const zipPath = path.join(dir, "b.zip");
    fs.writeFileSync(zipPath, createZip([{ name: "a.js", data: "x".repeat(5000) }]));
    const result = execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" });
    assert.match(result, /No errors detected/, "unzip found the archive corrupt, so the CRCs or offsets are wrong");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the same input gives byte-identical output", () => {
  const entries = [{ name: "a.js", data: "one" }, { name: "b.js", data: "two" }];
  const first = createZip(entries);
  const second = createZip(entries.map((entry) => ({ ...entry })));
  assert.ok(first.equals(second),
    "two builds of the same sources produced different bytes within one process");
});

// The test above is not enough on its own, and a probe proved it: replacing the
// fixed timestamp with `Date.now()` evaluated once at module load left it
// passing, because both zips in one process then share the same wrong value.
// The risk is variation *between builds*, so this builds the second zip in a
// separate process.
test("a build in another process produces the same bytes", () => {
  const entries = [{ name: "a.js", data: "one" }, { name: "b.js", data: "two" }];
  const here = require("node:crypto").createHash("sha256").update(createZip(entries)).digest("hex");

  const script = `
    const { createZip } = require(${JSON.stringify(path.join(__dirname, "..", "src", "bundle.js"))});
    const zip = createZip(${JSON.stringify(entries)}.map((e) => ({ name: e.name, data: e.data })));
    process.stdout.write(require("node:crypto").createHash("sha256").update(zip).digest("hex"));
  `;
  const there = execFileSync(process.execPath, ["-e", script], { encoding: "utf8" });

  assert.equal(here, there,
    "a second process built different bytes from identical sources, so every deploy would report every function as changed");
});

test("stores the fixed timestamp rather than the clock", () => {
  // Read the DOS time and date straight back out of the local file header.
  // Asserting the constant directly is what makes the property visible: a
  // timestamp is exactly the field that looks harmless and is not.
  const zip = createZip([{ name: "a.js", data: "one" }]);
  assert.equal(zip.readUInt16LE(10), 0, "the ZIP carries a modification time, so its bytes change on every build");
  assert.equal(zip.readUInt16LE(12), 33, "the ZIP carries a modification date, so its bytes change on every build");
});

test("the upload key follows the content, not the clock", () => {
  const a = createZip([{ name: "a.js", data: "one" }]);
  const b = createZip([{ name: "a.js", data: "one" }]);
  const c = createZip([{ name: "a.js", data: "TWO" }]);
  assert.equal(keyFor("app", a), keyFor("app", b), "identical content produced two different keys");
  assert.notEqual(keyFor("app", a), keyFor("app", c), "different content produced the same key, so a change would not deploy");
  assert.match(keyFor("app", a), /^app\/[0-9a-f]{32}\.zip$/);
});

test("stores a file mode Lambda can actually read", () => {
  const dir = scratch();
  try {
    const zipPath = path.join(dir, "b.zip");
    fs.writeFileSync(zipPath, createZip([{ name: "a.js", data: "x" }]));
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
    const mode = fs.statSync(path.join(dir, "out", "a.js")).mode & 0o777;
    assert.ok(mode & 0o400, `the unpacked file has mode ${mode.toString(8)}, which Lambda cannot read`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("collects a directory in sorted order rather than in readdir order", () => {
  const dir = scratch();
  try {
    fs.mkdirSync(path.join(dir, "handlers"));
    fs.writeFileSync(path.join(dir, "zebra.js"), "z");
    fs.writeFileSync(path.join(dir, "alpha.js"), "a");
    fs.writeFileSync(path.join(dir, "handlers", "one.js"), "1");
    const { entries } = collectFiles(dir);
    const names = entries.map((entry) => entry.name);
    assert.deepEqual(names, [...names].sort(),
      "files were collected in filesystem order, so two machines would build different bytes from identical sources");
    assert.ok(names.includes("handlers/one.js"), "a nested file was missed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("never bundles a .env file", () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "handler.js"), "x");
    fs.writeFileSync(path.join(dir, ".env"), "SECRET=hunter2");
    fs.writeFileSync(path.join(dir, ".env.production"), "SECRET=hunter2");
    const { entries, skipped } = collectFiles(dir);
    const names = entries.map((entry) => entry.name);
    assert.ok(!names.some((name) => name.startsWith(".env")),
      "a .env file was uploaded into a deployment package, which is how a secret ends up somewhere it can be read");
    assert.ok(skipped.length >= 2, "the skipped files were not reported, so nobody would know they had been left out");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("never bundles credentials or a .git directory", () => {
  assert.ok(isExcluded(".aws"));
  assert.ok(isExcluded("nested/.git"));
  assert.ok(isExcluded("id_rsa"));
  assert.ok(!isExcluded("handlers/environment.js"), "a legitimate file was excluded by an over-eager pattern");
});

test("refuses a project too large for Lambda rather than uploading it and failing there", () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "big.bin"), Buffer.alloc(2048));
    assert.throws(
      () => collectFiles(dir, { maxBytes: 1024 }),
      /before compression/,
      "an oversized project was packaged, so the failure would arrive from AWS after the upload"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("handles an empty file and a file with awkward bytes", () => {
  const dir = scratch();
  try {
    const zipPath = path.join(dir, "b.zip");
    fs.writeFileSync(zipPath, createZip([
      { name: "empty.js", data: "" },
      { name: "utf8.js", data: "// café — über\n" }
    ]));
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
    assert.equal(fs.readFileSync(path.join(dir, "out", "empty.js"), "utf8"), "");
    assert.equal(fs.readFileSync(path.join(dir, "out", "utf8.js"), "utf8"), "// café — über\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
