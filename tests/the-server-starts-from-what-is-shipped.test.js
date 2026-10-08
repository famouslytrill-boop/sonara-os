"use strict";

// The server has to start from the files that are shipped with it, not only
// from a full checkout.
//
// The route serving /.well-known/assetlinks.json read
// android/twa/build-contract.json when it was registered. Every test passed,
// because every test runs from the repository root, where that file exists. The
// Docker image copied api, routes, lib, config, data, openapi, scripts, ui and
// public -- not android -- so the image build died at startup with ENOENT
// (Docker Image CI on 9c30834c).
//
// It was fixed twice, from two sides, and both are kept. This branch moved the
// association into lib/sonara-android-app-association.cjs, so the route reads
// nothing from android/. Main, separately, began shipping android/ in the image
// (`COPY android ./android`, 4d1b74a0). The first of those is the one that
// matters off Docker: the Vercel function declares
// `"includeFiles": "{public/**,routes/**,lib/**}"` (vercel.json, read 8 October
// 2026), which does not include android/. So this holds both: the server starts
// from exactly what the Dockerfile copies, and it starts without the TWA build
// directory at all.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");

function shippedPaths() {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const paths = [];
  for (const line of dockerfile.split(/\r?\n/)) {
    const copy = /^COPY\s+(?!--from)(.+)$/i.exec(line.trim());
    if (!copy) continue;
    const parts = copy[1].trim().split(/\s+/);
    paths.push(...parts.slice(0, -1));
  }
  return paths;
}

describe("the server starts from what is shipped", function () {
  this.timeout(60000);

  it("reads the Dockerfile's copy list rather than a list of its own", () => {
    const paths = shippedPaths();
    assert.ok(paths.length >= 10, `only ${paths.length} shipped paths were read from the Dockerfile, so this check has gone blind`);
    assert.ok(paths.includes("server.js") && paths.includes("lib") && paths.includes("routes"), `the Dockerfile copy list no longer looks like the server: ${paths.join(", ")}`);
  });

  // Copy these paths, and nothing else, and start the server from the copy.
  function startsFrom(paths) {
    const image = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-shipped-"));
    try {
      for (const relative of paths) {
        fs.cpSync(path.join(root, relative), path.join(image, relative), { recursive: true });
      }
      fs.symlinkSync(path.join(root, "node_modules"), path.join(image, "node_modules"), "dir");
      // Exactly what was asked for: a copy that held more than the image ships
      // would pass by finding a file the image does not have.
      const expected = new Set([...paths.map((relative) => relative.split("/")[0]), "node_modules"]);
      const extra = fs.readdirSync(image).filter((name) => !expected.has(name));
      assert.deepEqual(extra, [], "the copy holds more than was shipped, so it is not what the image ships");
      const started = spawnSync(process.execPath, ["-e", "require('./server')"], {
        cwd: image,
        env: { ...process.env, NODE_ENV: "test" },
        encoding: "utf8",
        timeout: 45000
      });
      const reason = `${started.stderr || ""}`.split("\n").filter((line) => /Error|ENOENT|Cannot find/.test(line)).slice(0, 5).join("\n");
      return { ok: started.status === 0, reason: reason || started.stderr };
    } finally {
      fs.rmSync(image, { recursive: true, force: true });
    }
  }

  it("loads server.js with only the files the Dockerfile copies", () => {
    const started = startsFrom(shippedPaths());
    assert.ok(started.ok, `the server did not start from the shipped files:\n${started.reason}`);
  });

  it("loads server.js without the TWA build directory, which the Vercel function does not bundle", () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
    const declared = JSON.stringify(vercel.functions || {});
    assert.ok(!/android/.test(declared), "vercel.json now bundles android/; this test's reason for existing has changed, so read it again");
    const started = startsFrom(shippedPaths().filter((relative) => relative.split("/")[0] !== "android"));
    assert.ok(started.ok, `the server needs android/ to start, and the Vercel function does not ship it:\n${started.reason}`);
  });
});
