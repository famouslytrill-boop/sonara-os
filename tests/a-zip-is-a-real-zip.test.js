"use strict";

// The zip writer, checked against a zip reader this project did not write.
//
// A binary format is the easiest place to be confidently wrong. Bytes come out,
// the length looks plausible, nothing throws -- and the file will not open. So
// the archive is handed to `unzip`, including its own integrity check, rather
// than being read back by the same code that wrote it. A reader written from
// the same misunderstanding as the writer agrees with it perfectly.
//
// The determinism half matters for two different reasons in the two callers.
// The serverless CLI keys its upload on the archive's hash, so bytes that
// change on every build make CloudFormation report every function as updated
// every time -- and a plan that always says "1 function to update" is a plan
// people stop reading. A scroll-site export has a simpler version of the same
// problem: a customer cannot tell whether today's download differs from
// yesterday's.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const { createZip } = require("../lib/sonara-zip.cjs");

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sonara-zip-"));
}

describe("a zip is a real zip", () => {
  it("produces something unzip accepts, with the contents intact", () => {
    const dir = scratch();
    try {
      const zipPath = path.join(dir, "site.zip");
      fs.writeFileSync(zipPath, createZip([
        { name: "index.html", data: "<!doctype html><title>A site</title>\n" },
        { name: "assets/styles.css", data: "body{margin:0}\n" }
      ]));

      const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
      assert.match(listing, /index\.html/);
      assert.match(listing, /assets\/styles\.css/, "a nested path did not survive");

      execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
      assert.equal(
        fs.readFileSync(path.join(dir, "out", "index.html"), "utf8"),
        "<!doctype html><title>A site</title>\n",
        "the file came back out different from how it went in"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes unzip's own integrity check", () => {
    const dir = scratch();
    try {
      const zipPath = path.join(dir, "b.zip");
      // Long enough that deflate actually compresses, so the CRC is computed
      // over something other than a stored copy.
      fs.writeFileSync(zipPath, createZip([{ name: "frames/0001.txt", data: "x".repeat(20000) }]));
      assert.match(
        execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" }),
        /No errors detected/,
        "unzip found the archive corrupt, so the CRCs or the offsets are wrong"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("carries binary bytes through unchanged", () => {
    const dir = scratch();
    try {
      // A frame or an audio file is not text, and a writer that is quietly
      // doing something UTF-8 shaped to its input corrupts exactly those.
      const bytes = crypto.randomBytes(4096);
      const zipPath = path.join(dir, "b.zip");
      fs.writeFileSync(zipPath, createZip([{ name: "audio/track.bin", data: bytes }]));
      execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
      assert.ok(
        fs.readFileSync(path.join(dir, "out", "audio", "track.bin")).equals(bytes),
        "binary content did not survive the round trip"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gives identical bytes for identical input, in a separate process", () => {
    // Two calls in one process is not the property that matters, and a probe
    // proved it: a timestamp read once at module load looks deterministic from
    // inside a single process. This builds the second archive elsewhere.
    const entries = [{ name: "a.txt", data: "one" }, { name: "b.txt", data: "two" }];
    const here = crypto.createHash("sha256").update(createZip(entries)).digest("hex");

    const script = `
      const { createZip } = require(${JSON.stringify(path.join(__dirname, "..", "lib", "sonara-zip.cjs"))});
      const zip = createZip(${JSON.stringify(entries)});
      process.stdout.write(require("node:crypto").createHash("sha256").update(zip).digest("hex"));
    `;
    const there = execFileSync(process.execPath, ["-e", script], { encoding: "utf8" });

    assert.equal(here, there, "a second process built different bytes from identical input");
  });

  it("stores the fixed timestamp rather than the clock", () => {
    const zip = createZip([{ name: "a.txt", data: "one" }]);
    assert.equal(zip.readUInt16LE(10), 0, "the archive carries a modification time, so its bytes change every build");
    assert.equal(zip.readUInt16LE(12), 33, "the archive carries a modification date, so its bytes change every build");
  });

  it("unpacks with a mode the file can actually be read at", () => {
    const dir = scratch();
    try {
      const zipPath = path.join(dir, "b.zip");
      fs.writeFileSync(zipPath, createZip([{ name: "index.html", data: "<p>hi</p>" }]));
      execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
      const mode = fs.statSync(path.join(dir, "out", "index.html")).mode & 0o777;
      assert.ok(mode & 0o400, `the unpacked file has mode ${mode.toString(8)}, which nothing can read`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles an empty file and awkward bytes rather than skipping them", () => {
    const dir = scratch();
    try {
      const zipPath = path.join(dir, "b.zip");
      fs.writeFileSync(zipPath, createZip([
        { name: "empty.txt", data: "" },
        { name: "utf8.txt", data: "// café — über\n" }
      ]));
      execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
      assert.equal(fs.readFileSync(path.join(dir, "out", "empty.txt"), "utf8"), "");
      assert.equal(fs.readFileSync(path.join(dir, "out", "utf8.txt"), "utf8"), "// café — über\n");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
