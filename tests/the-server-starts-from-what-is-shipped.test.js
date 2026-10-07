"use strict";

// The server has to start from the files that are shipped with it, not only
// from a full checkout.
//
// The route serving /.well-known/assetlinks.json read
// android/twa/build-contract.json when it was registered. Every test passed,
// because every test runs from the repository root, where that file exists. The
// Docker image copies api, routes, lib, config, data, openapi, scripts, ui and
// public -- not android -- so the image build died at startup with ENOENT
// (Docker Image CI on 9c30834c). Vercel bundles even less by declaration.
//
// This copies exactly what the Dockerfile copies, reading its COPY lines rather
// than a list written here, and starts the server from that.

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

  it("loads server.js with only those files present", () => {
    const image = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-shipped-"));
    try {
      for (const relative of shippedPaths()) {
        fs.cpSync(path.join(root, relative), path.join(image, relative), { recursive: true });
      }
      fs.symlinkSync(path.join(root, "node_modules"), path.join(image, "node_modules"), "dir");
      assert.equal(fs.existsSync(path.join(image, "android")), false, "the shipped copy contains android/, so it is not what the image ships");
      const started = spawnSync(process.execPath, ["-e", "require('./server')"], {
        cwd: image,
        env: { ...process.env, NODE_ENV: "test" },
        encoding: "utf8",
        timeout: 45000
      });
      const reason = `${started.stderr || ""}`.split("\n").filter((line) => /Error|ENOENT|Cannot find/.test(line)).slice(0, 5).join("\n");
      assert.equal(started.status, 0, `the server did not start from the shipped files:\n${reason || started.stderr}`);
    } finally {
      fs.rmSync(image, { recursive: true, force: true });
    }
  });
});
