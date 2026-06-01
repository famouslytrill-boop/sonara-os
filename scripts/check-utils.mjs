import fs from "node:fs";
import path from "node:path";
import { repoRoot, walkFiles } from "./workspace.mjs";

export const sourceRoots = ["packages", "scripts", ".github", "docs", "supabase"];

export function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

export function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

export function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

export function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

export function listFiles(roots = sourceRoots) {
  return roots
    .filter((root) => exists(root))
    .flatMap((root) => {
      const absoluteRoot = repoPath(root);
      if (fs.statSync(absoluteRoot).isFile()) {
        return [absoluteRoot];
      }
      return walkFiles(absoluteRoot, (filePath) =>
        /\.(ts|tsx|js|mjs|json|md|html|yml|yaml|svg|toml|sql|example)$/.test(filePath)
      );
    })
    .sort();
}

export function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

export function failIfIssues(title, issues) {
  if (issues.length > 0) {
    throw new Error(`${title} failed:\n${issues.join("\n")}`);
  }
  console.log(`${title} passed.`);
}

export function linesWith(filePath, pattern) {
  const source = fs.readFileSync(filePath, "utf8");
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => pattern.test(line));
}

export function isAllowedSafetyContext(line) {
  return /\b(no|not|never|blocked|disable|disabled|without|prohibit|prohibited|forbidden|review|required|warning|policy)\b/i.test(
    line
  );
}
