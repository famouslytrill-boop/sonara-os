import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(root, ".github", "workflows");

const approved = new Map([
  ["actions/checkout", "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/upload-artifact", "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"],
  ["actions/setup-python", "ece7cb06caefa5fff74198d8649806c4678c61a1"],
  ["pnpm/action-setup", "0977fd99725f1db4007ccb2928dbb4e90d06cc86"],
  ["github/codeql-action", "b96794f015dfd88f77b49b1c93e0fa7110f94c63"],
  ["supabase/setup-cli", "46f7f98c7f948ad727d22c1e67fab04c223a0520"]
]);

const fullSha = /^[0-9a-f]{40}$/;
const files = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/i.test(name)).sort();
const problems = [];
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
    const at = target.lastIndexOf("@");
    if (at < 1) {
      problems.push(`${file}:${index + 1}: external action has no immutable ref: ${target}`);
      continue;
    }

    const actionPath = target.slice(0, at);
    const ref = target.slice(at + 1);
    const parts = actionPath.split("/");
    if (parts.length < 2) {
      problems.push(`${file}:${index + 1}: unrecognized external action path: ${target}`);
      continue;
    }

    const action = parts.slice(0, 2).join("/");
    const expected = approved.get(action);
    if (!fullSha.test(ref)) {
      problems.push(`${file}:${index + 1}: ${action} uses mutable ref "${ref}"; require a full 40-character commit SHA.`);
      continue;
    }
    if (!expected) {
      problems.push(`${file}:${index + 1}: ${action} is not approved; review and register it before use.`);
      continue;
    }
    if (ref !== expected) {
      problems.push(`${file}:${index + 1}: ${action} is pinned to ${ref}, expected reviewed commit ${expected}.`);
    }
  }
}

if (problems.length) {
  console.error("GitHub Actions supply-chain policy failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`GitHub Actions supply-chain policy verified: ${checked} external action reference(s) use approved immutable commits across ${files.length} workflow file(s).`);
