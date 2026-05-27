import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["app", "components", "lib", "config", "public", "tests", "frontend", "src", "backend", "python", "services", "supabase", "utils"];
const blocked = [/TrackFoundry/g, /LineReady/g, /NoticeGrid/g, /Signal OS/g, /signal-os/g, /SONARA OS/g];
const ignore = new Set(["node_modules", ".next", ".git"]);
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignore.has(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }

    if (/next\.config\.(mjs|js|ts)$/.test(path)) {
      continue;
    }

    if (!/\.(tsx?|jsx?|json|md|svg|webmanifest|css|mjs|cjs)$/.test(path)) {
      continue;
    }

    const text = readFileSync(path, "utf8");
    for (const pattern of blocked) {
      if (pattern.test(text)) {
        failures.push(`${relative(process.cwd(), path)} contains ${pattern.source}`);
      }
      pattern.lastIndex = 0;
    }
  }
}

for (const root of roots) {
  walk(join(process.cwd(), root));
}

if (failures.length) {
  console.error("Legacy public copy found:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("No legacy public copy found in active app surfaces.");
