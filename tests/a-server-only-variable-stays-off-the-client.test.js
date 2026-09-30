"use strict";

// A variable the provider register calls server-only does not appear in the
// directory served to browsers.
//
// `data/provider-registry.ts` names seven variables as server-only: the Supabase
// service-role key and database password, both Stripe secrets, the OpenRouter key,
// the GitHub token, the Resend key. AGENTS.md states the rule they exist for --
// keep service-role secrets server-only -- and `public/` is the directory a
// browser downloads.
//
// Measured 30 September 2026: `data/provider-registry.ts` was read by **no other
// file in the repository**. Its only reader was
// `scripts/check-provider-registry.mjs`, which nothing ran, whose only caller was
// `scripts/verify-all.mjs`, which nothing ran either. And that check asked:
//
//     if (!text.includes("serverOnlyEnv")) findings.push("provider records must declare serverOnlyEnv");
//
// One occurrence anywhere in the file satisfied it -- and the TYPE declaration
// contains the word, so it passed on the type alone. Proven: with a record's
// `serverOnlyEnv` field removed entirely, that check still found the word and
// reported a pass.
//
// The guarantee held anyway, by convention. Nothing was asking.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const GATE = "scripts/verify-provider-and-technology-registers.mjs";
const PROVIDERS = "data/provider-registry.ts";
const COMMAND = "verify:provider-registers";

function serverOnlyNames() {
  const source = fs.readFileSync(path.join(root, PROVIDERS), "utf8");
  const start = source.indexOf("providerRegistry: ProviderRegistryRecord[] = [");
  assert.notEqual(start, -1, `${PROVIDERS} has no providerRegistry array`);
  const names = new Set();
  for (const record of source.slice(start).split(/\n  \{/).slice(1)) {
    const list = /serverOnlyEnv: \[([^\]]*)\]/.exec(record);
    for (const quoted of (list?.[1] || "").match(/"[^"]+"/g) || []) names.add(quoted.slice(1, -1));
  }
  return names;
}

function publicFiles() {
  const found = [];
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(path.relative(root, full));
    }
  })(path.join(root, "public"));
  return found;
}

describe("a server-only variable stays off the client", () => {
  it("has server-only names to check for", () => {
    const names = serverOnlyNames();
    assert.ok(
      names.size >= 5,
      `only ${names.size} server-only variable(s) parsed from ${PROVIDERS}; with none there would be nothing to ` +
        "search for and every file under public/ would read clean"
    );
  });

  // The property itself, asserted here as well as in the gate. This is the
  // AGENTS.md rule, and one of the two should not be the only place it lives.
  it("finds none of them under public/", () => {
    const names = serverOnlyNames();
    const served = publicFiles();
    assert.ok(served.length >= 40, `only ${served.length} files found under public/; the walk has gone blind`);

    const leaks = [];
    for (const relative of served) {
      let source;
      try {
        source = fs.readFileSync(path.join(root, relative), "utf8");
      } catch {
        continue;
      }
      for (const variable of names) {
        if (source.includes(variable)) leaks.push(`${relative} -> ${variable}`);
      }
    }
    assert.deepEqual(
      leaks,
      [],
      `${leaks.length} server-only variable name(s) appear in files a browser downloads: ${leaks.join(", ")}`
    );
  });

  // Per record, which is the difference between this gate and the one it replaces.
  it("requires the declaration on every record, not once per file", () => {
    const source = fs.readFileSync(path.join(root, PROVIDERS), "utf8");
    const start = source.indexOf("providerRegistry: ProviderRegistryRecord[] = [");
    const records = source.slice(start).split(/\n  \{/).slice(1);
    assert.ok(records.length >= 4, `only ${records.length} provider records parsed; the split has gone blind`);

    const missing = [];
    for (const record of records) {
      const name = /name: "([^"]+)"/.exec(record)?.[1] ?? "(unnamed)";
      if (!/serverOnlyEnv: \[/.test(record)) missing.push(`${name}: serverOnlyEnv`);
      if (!/publicEnv: \[/.test(record)) missing.push(`${name}: publicEnv`);
      if (!/humanReviewRequired: (?:true|false)/.test(record)) missing.push(`${name}: humanReviewRequired`);
    }
    assert.deepEqual(missing, [], `${missing.length} provider field(s) absent: ${missing.join(", ")}`);
  });

  it("runs the gate from the release chain", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const { chainCommands } = require("../lib/sonara-release-chain.cjs");

    assert.ok(pkg.scripts[COMMAND], `package.json has no ${COMMAND} script`);
    assert.ok(pkg.scripts[COMMAND].includes(GATE), `${COMMAND} runs "${pkg.scripts[COMMAND]}", which does not name ${GATE}`);

    const chain = chainCommands(pkg.scripts);
    assert.ok(chain.length > 40, `only ${chain.length} chain commands read; the chain walk has gone blind`);
    assert.ok(
      chain.includes(COMMAND),
      `${COMMAND} is not reachable from verify:launch. Its predecessor was reachable from nothing, which is why ` +
        "this register went unchecked while being the only statement of which variables must stay off the client."
    );
  });

  it("reports what it searched, not just a verdict", () => {
    const output = execFileSync(process.execPath, [path.join(root, GATE)], { cwd: root, encoding: "utf8" });
    const variables = Number(/The (\d+) variables declared server-only/.exec(output)?.[1]);
    const served = Number(/none of the (\d+) files under public\//.exec(output)?.[1]);

    assert.equal(variables, serverOnlyNames().size, "the gate reports a different number of server-only variables from the register");
    assert.equal(served, publicFiles().length, "the gate reports a different number of public/ files from the number on disk");
  });
});
