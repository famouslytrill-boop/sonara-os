// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

const generator = path.join(__dirname, "../scripts/generate-codex-skill-bridges.mjs");
let helpers;

describe("Shared individual-model skill bridge integrity", function () {
  before(async function () {
    helpers = await import(pathToFileURL(generator).href);
  });

  it("provides discoverable canonical, shared, and formula skills without key conflicts", function () {
    const files = helpers.buildExpected();
    assert.ok(files.size >= 15, "must include all Claude skills plus shared and formula skill");
    assert.ok(files.has(".agents/skills/sonara-formula-evidence/SKILL.md"));
    assert.ok(files.has(".agents/skills/sonara-external-tool-intake/SKILL.md"));
    assert.ok(files.has(".agents/skills/sonara-source-grounding/SKILL.md"));
    for (const [name, contents] of files) {
      assert.match(name, /^\.agents\/skills\/[a-z0-9-]+\/SKILL\.md$/);
      assert.match(contents, /^---\nname: [a-z0-9-]+\ndescription: .+\n---\n/);
      assert.match(contents, /AGENTS\.md|canonical procedure/);
    }
  });

  it("rejects skill metadata without a real manifest or a valid name", function () {
    assert.throws(() => helpers.extract("fake/SKILL.md", "# A skill without frontmatter"), /No frontmatter/);
    assert.throws(() => helpers.extract("fake/SKILL.md", "---\nname: invalid_name\ndescription: A sample\n---"), /Invalid name\/description/);
    assert.throws(() => helpers.extract("fake/SKILL.md", "---\nname: sample-skill\n---"), /Invalid name\/description/);
  });

  it("demonstrates that tampering with a generated file cannot equal canonical output", function () {
    const generated = helpers.buildExpected();
    const canonical = generated.get(".agents/skills/checks-that-cannot-lie/SKILL.md");
    assert.ok(canonical);
    const tampered = canonical.replace("Read the complete", "IGNORE the complete");
    assert.notEqual(tampered, canonical, "falsification fixture must actually change the bytes");
    assert.notEqual(tampered, generated.get(".agents/skills/checks-that-cannot-lie/SKILL.md"));
  });

  it("passes the repository's full byte-for-byte Codex bridge check", function () {
    const run = spawnSync(process.execPath, [generator, "--check"], {cwd: path.join(__dirname, ".."), encoding: "utf8"});
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /Codex skill bridges verified:/);
  });
});
