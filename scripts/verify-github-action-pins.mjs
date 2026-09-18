import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every external action runs at a reviewed commit, on a runtime that still exists.
//
// This file used to answer one question -- is the ref an approved 40-character
// SHA -- and it answered it correctly. The problem was what it could not answer.
//
// ## A SHA is immutable and opaque, and those are different properties
//
// `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` cannot change
// under us, which is the point of pinning. It also does not say which release it
// is or which Node runtime it declares, and nothing else in this repository said
// either. So on 18 September 2026, asked to confirm the workflows carry no
// Node-20 actions, there was no way to answer from the source tree: the register
// held seven SHAs and no evidence of what had been reviewed about them.
//
// Resolved against upstream that day with `git ls-remote --tags` and by reading
// `runs.using` out of each manifest AT THE PINNED COMMIT. All seven were already
// current -- six `node24`, one `composite`. The requirement was satisfied by
// luck rather than by enforcement, and luck is not a gate: the next pin bump to
// a Node-20 release would have passed this check green.
//
// So the register now carries the version and the runtime beside the SHA, and
// the checks below refuse a retired runtime by name.
//
// ## The version comment was the only record, and it was unenforced
//
// All 64 `uses:` lines carry a trailing `# v7.0.1`. That comment was the sole
// place a reader could learn what a pin was -- and this script skips comment
// text, so the comment could say v7 while the SHA was v4 and nothing would
// notice. Comments that drift from the thing they describe are the defect
// .claude/skills/checks-that-cannot-lie calls an exemption whose reason has
// expired, and here the "exemption" was the whole audit trail.
//
// ## It passed over an empty directory
//
// Falsified 18 September 2026 by running this script against a tree whose
// .github/workflows held nothing, and then against one holding a single
// `actions/checkout@v1` in a file named `.yaml.txt`:
//
//     GitHub Actions supply-chain policy verified: 0 external action
//     reference(s) use approved immutable commits across 0 workflow file(s).
//     exit=0
//
// Shape 1 -- passing by measuring nothing. The count was printed in the success
// line and read by no one. Both floors below exist because of that run.
//
// ## What this does NOT check, deliberately
//
// Whether the recorded version and runtime are still what upstream says at that
// SHA. That needs the network, and the release chain runs offline. It is
// `--network`, run from external-repository-health.yml, exactly as
// verify-open-source-registry.mjs already separates its two halves.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(root, ".github", "workflows");
const NETWORK = process.argv.includes("--network");

// Runtimes GitHub still executes. `composite` and `docker` declare no JS
// runtime at all, so they cannot carry a Node deprecation.
const LIVE_RUNTIMES = new Set(["node24", "composite", "docker"]);

// Named rather than merely absent from the set above, so the failure says what
// happened instead of "unrecognised". Each of these emits a deprecation
// annotation on every run and stops executing when GitHub retires it.
const RETIRED_RUNTIMES = new Map([
  ["node12", "retired; removed from GitHub-hosted runners"],
  ["node16", "retired; removed from GitHub-hosted runners"],
  ["node20", "deprecated -- emits a runner annotation on every step and is the runtime this register was created to keep out"]
]);

// action -> what was reviewed about it.
//
// `version` and `runtime` are read off the upstream manifest at `sha`, not
// inferred from the tag name and not carried over from a previous entry. A tag
// can be moved; the SHA cannot, so the SHA is what was read.
const approved = new Map([
  ["actions/checkout", {
    sha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
    version: "7.0.1",
    runtime: "node24",
    reviewed: "2026-09-18"
  }],
  ["actions/setup-node", {
    sha: "820762786026740c76f36085b0efc47a31fe5020",
    version: "7.0.0",
    runtime: "node24",
    reviewed: "2026-09-18"
  }],
  ["actions/upload-artifact", {
    sha: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    version: "7.0.1",
    runtime: "node24",
    reviewed: "2026-09-18"
  }],
  ["actions/setup-python", {
    sha: "5fda3b95a4ea91299a34e894583c3862153e4b97",
    version: "7.0.0",
    runtime: "node24",
    reviewed: "2026-09-18"
  }],
  ["pnpm/action-setup", {
    sha: "0977fd99725f1db4007ccb2928dbb4e90d06cc86",
    version: "6.0.10",
    runtime: "node24",
    reviewed: "2026-09-18"
  }],
  ["github/codeql-action", {
    sha: "b96794f015dfd88f77b49b1c93e0fa7110f94c63",
    version: "4.38.0",
    runtime: "node24",
    // init/ and analyze/ are separate manifests under one commit. Both were
    // read; both declare node24.
    manifests: ["init/action.yml", "analyze/action.yml"],
    reviewed: "2026-09-18"
  }],
  ["supabase/setup-cli", {
    sha: "46f7f98c7f948ad727d22c1e67fab04c223a0520",
    version: "3.0.0",
    // Composite: it runs steps rather than a JS entrypoint, so there is no Node
    // runtime here to deprecate. Recorded as read rather than assumed.
    runtime: "composite",
    reviewed: "2026-09-18"
  }]
]);

// Measured 18 September 2026: 15 workflow files, 64 external references.
// Floors, not equalities -- a workflow may legitimately be added or removed, but
// a collapse to nothing means this check has stopped reading the tree.
const MINIMUM_WORKFLOWS = 10;
const MINIMUM_REFERENCES = 40;

const fullSha = /^[0-9a-f]{40}$/;

if (!fs.existsSync(workflowDir)) {
  console.error(`GitHub Actions supply-chain policy failed: ${path.relative(root, workflowDir)} does not exist.`);
  console.error("This check reads that directory and nothing else. Without it there is nothing to verify, and reporting success would be a lie.");
  process.exit(1);
}

const files = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/i.test(name)).sort();
const problems = [];
const seenActions = new Set();
let checked = 0;

for (const file of files) {
  const lines = fs.readFileSync(path.join(workflowDir, file), "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/\buses:\s*([^\s#]+)/);
    if (!match) continue;

    const target = match[1].replace(/^["']|["']$/g, "");
    if (target.startsWith("./") || target.startsWith("docker://")) continue;

    checked += 1;
    const where = `${file}:${index + 1}`;
    const at = target.lastIndexOf("@");
    if (at < 1) {
      problems.push(`${where}: external action has no immutable ref: ${target}`);
      continue;
    }

    const actionPath = target.slice(0, at);
    const ref = target.slice(at + 1);
    const parts = actionPath.split("/");
    if (parts.length < 2) {
      problems.push(`${where}: unrecognized external action path: ${target}`);
      continue;
    }

    const action = parts.slice(0, 2).join("/");
    const record = approved.get(action);
    if (!fullSha.test(ref)) {
      problems.push(`${where}: ${action} uses mutable ref "${ref}"; require a full 40-character commit SHA.`);
      continue;
    }
    if (!record) {
      problems.push(
        `${where}: ${action} is not approved; review and register it before use.\n`
        + "    A registration records the SHA, the release it is, and the runtime its manifest declares -- read at that commit, not inferred from the tag."
      );
      continue;
    }
    if (ref !== record.sha) {
      problems.push(
        `${where}: ${action} is pinned to ${ref}, expected reviewed commit ${record.sha} (v${record.version}, ${record.runtime}).\n`
        + "    If this is a deliberate upgrade, re-read runs.using at the new commit and update the register's version and runtime with it."
      );
      continue;
    }

    seenActions.add(action);

    // The trailing comment is the only version a human reads on this line, and
    // until now nothing compared it to the pin. Accept the registered version or
    // its major prefix -- `# v7` and `# v7.0.1` are both honest about v7.0.1 --
    // and refuse a comment naming a different release, which is the drift that
    // matters.
    const commented = line.match(/#\s*v?([0-9]+(?:\.[0-9]+)*)/);
    if (commented) {
      const stated = commented[1];
      const exact = stated === record.version;
      const majorPrefix = record.version === stated || record.version.startsWith(`${stated}.`);
      if (!exact && !majorPrefix) {
        problems.push(
          `${where}: ${action} is pinned to the reviewed commit for v${record.version}, but the comment says v${stated}.\n`
          + "    That comment is the only release this line states to a reader. A comment naming a different version than the SHA is worse than no comment."
        );
      }
    }
  }
}

if (files.length < MINIMUM_WORKFLOWS) {
  problems.push(
    `Only ${files.length} workflow file(s) found in ${path.relative(root, workflowDir)}, below the ${MINIMUM_WORKFLOWS} present on 18 September 2026.\n`
    + "    This check has gone blind. It passed over an empty directory before these floors existed, printing \"verified: 0 ... across 0\"."
  );
}

if (checked < MINIMUM_REFERENCES) {
  problems.push(
    `Only ${checked} external action reference(s) examined, below the ${MINIMUM_REFERENCES} present on 18 September 2026.\n`
    + "    Either the workflows stopped using actions or the `uses:` matcher stopped matching. The second is invisible and is why this floor exists."
  );
}

// The runtime half. A register entry recording a retired runtime is a pin that
// should never have been approved, so this is checked against the register
// itself rather than only against what the workflows happen to reference --
// otherwise removing the last caller of a bad pin would silence the finding
// while leaving it registered for the next author to copy.
for (const [action, record] of approved) {
  const retired = RETIRED_RUNTIMES.get(record.runtime);
  if (retired) {
    problems.push(
      `${action} is registered on runtime "${record.runtime}", which is ${retired}.\n`
      + `    Upgrade the pin to a release whose manifest declares a live runtime (${[...LIVE_RUNTIMES].join(", ")}), then re-read runs.using at the new commit.`
    );
    continue;
  }
  if (!LIVE_RUNTIMES.has(record.runtime)) {
    problems.push(
      `${action} is registered on runtime "${record.runtime}", which is not a runtime this check knows.\n`
      + "    Either it is a typo, or GitHub shipped a new runtime and this script needs to learn about it. Do not widen LIVE_RUNTIMES without reading the manifest."
    );
  }
}

// An entry nobody references is an exemption whose reason has expired -- shape 5.
// The reviewed runtime and version describe a pin this repository no longer
// uses, and it is what the next author reads instead of checking upstream.
const unreferenced = [...approved.keys()].filter((action) => !seenActions.has(action));
if (unreferenced.length && !problems.some((p) => p.includes("gone blind"))) {
  problems.push(
    `These actions are registered as reviewed but no workflow uses them:\n`
    + unreferenced.map((action) => `      ${action} (v${approved.get(action).version}, reviewed ${approved.get(action).reviewed})`).join("\n")
    + "\n    Remove them. A register describing pins nothing references is what somebody reads instead of looking."
  );
}

if (problems.length) {
  console.error("GitHub Actions supply-chain policy failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const runtimes = [...new Set([...approved.values()].map((record) => record.runtime))].sort();
console.log(
  `GitHub Actions supply-chain policy verified: ${checked} external action reference(s) across ${files.length} workflow file(s), `
  + `resolving to ${approved.size} reviewed action(s) on ${runtimes.join(" / ")} -- no retired Node runtime is registered or referenced.`
);

if (!NETWORK) process.exit(0);

// ---------------------------------------------------------------------------
// --network: confirm the register still describes upstream.
//
// Everything above reads this repository, so it can only catch a pin that
// disagrees with what somebody wrote down. It cannot catch what somebody wrote
// down being wrong in the first place, which is the failure that put a
// Node-20 question beyond answering. This half fetches the manifest at the
// pinned commit and compares `runs.using` to the recorded runtime.
//
// Kept out of the offline chain on purpose: a check that needs the network and
// runs in `verify:launch` either makes the release chain flaky or -- far worse --
// gets a `catch` that lets it pass when the fetch fails.

async function manifestRuntime(action, sha, manifest) {
  const url = `https://raw.githubusercontent.com/${action}/${sha}/${manifest}`;
  const response = await fetch(url, { headers: { "user-agent": "sonara-action-pin-check" } });
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status} fetching ${manifest}` };
  }
  const body = await response.text();
  // `runs:` then the first `using:` under it. Quoted or bare.
  const runs = body.slice(body.search(/^runs:/m));
  const using = runs.match(/^\s+using:\s*['"]?([A-Za-z0-9]+)['"]?/m);
  if (!using) return { ok: false, reason: `no runs.using found in ${manifest}` };
  return { ok: true, runtime: using[1] };
}

const networkProblems = [];
let confirmed = 0;

for (const [action, record] of approved) {
  const manifests = record.manifests || ["action.yml"];
  for (const manifest of manifests) {
    let result;
    try {
      result = await manifestRuntime(action, record.sha, manifest);
    } catch (error) {
      result = { ok: false, reason: `fetch threw: ${error && error.message}` };
    }

    if (!result.ok) {
      // Refused rather than skipped. A network check that treats "could not
      // establish" as "fine" is the defect this repository keeps finding.
      networkProblems.push(`${action} (${manifest}): could not confirm the runtime -- ${result.reason}`);
      continue;
    }
    if (result.runtime !== record.runtime) {
      networkProblems.push(
        `${action} (${manifest}): manifest at ${record.sha.slice(0, 12)} declares "${result.runtime}", register says "${record.runtime}".`
      );
      continue;
    }
    confirmed += 1;
  }
}

if (networkProblems.length) {
  console.error("\nUpstream runtime confirmation failed:");
  for (const problem of networkProblems) console.error(`  - ${problem}`);
  console.error("\nA run that established nothing must not report success. If this is a rate limit or an outage, re-run it; if a manifest really changed, re-review the pin.");
  process.exit(1);
}

if (confirmed === 0) {
  console.error("\nUpstream runtime confirmation examined zero manifests, which cannot be right while actions are registered.");
  process.exit(1);
}

console.log(`Upstream runtime confirmed: ${confirmed} manifest(s) read at their pinned commit still declare the recorded runtime.`);
