import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", ".vercel"]);
const buildOutputDirectories = new Set([".next", "dist", "build", "out"]);
const readableExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".html"]);
const apiKeyPatterns = [
  /\bsk_(?:live|test)_[A-Za-z0-9_=-]{12,}\b/g,
  /\b(?:api[_-]?key|client[_-]?secret|webhook[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}/gi
];
const serviceRolePatterns = [
  /^SUPABASE_SERVICE_ROLE_KEY[^\S\r\n]*=[^\S\r\n]*(?!["']?(?:placeholder|replace-me|todo|example)\b)["']?\S{12,}/gim,
  /\bservice[_-]?role\b[\s\S]{0,80}\beyJ[A-Za-z0-9_-]{16,}/gi
];

const findings = [];
scanDirectory(repoRoot, false);

const criticalFindings = findings.filter((finding) => finding.severity === "critical");
for (const finding of findings) {
  console.log(`[${finding.severity}] ${finding.type}: ${finding.filePath} - ${finding.message}`);
}

console.log(
  `Source leak artifact scan complete. findings=${findings.length} critical=${criticalFindings.length}`
);

if (criticalFindings.length > 0) {
  process.exit(1);
}

function scanDirectory(directory, insideBuildOutput) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      scanDirectory(absolutePath, insideBuildOutput || buildOutputDirectories.has(entry.name));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    scanFile(absolutePath, insideBuildOutput);
  }
}

function scanFile(absolutePath, insideBuildOutput) {
  const relativePath = path.relative(repoRoot, absolutePath);
  const fileName = path.basename(absolutePath);
  const extension = path.extname(absolutePath);

  if (isUnsafeEnvFile(fileName)) {
    addFinding("env_file", "critical", relativePath, "Real environment file detected.");
  }

  if (insideBuildOutput && extension === ".map") {
    addFinding("source_map", "high", relativePath, "Source map found in build output.");
  }

  if (!shouldReadFile(fileName, extension)) {
    return;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  if (matchesAnyPattern(apiKeyPatterns, content)) {
    addFinding("api_key_pattern", "critical", relativePath, "API key-like value detected.");
  }
  if (matchesAnyPattern(serviceRolePatterns, content)) {
    addFinding(
      "service_role_pattern",
      "critical",
      relativePath,
      "Service-role key pattern detected."
    );
  }
}

function shouldReadFile(fileName, extension) {
  return fileName.startsWith(".env") || readableExtensions.has(extension);
}

function isUnsafeEnvFile(fileName) {
  if (!fileName.startsWith(".env")) {
    return false;
  }
  return !/\.(example|sample|template)(?:\..*)?$/i.test(fileName);
}

function matchesAnyPattern(patterns, content) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
}

function addFinding(type, severity, filePath, message) {
  findings.push({ type, severity, filePath, message });
}
