import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ignoredDirs = new Set([".git", ".next", "node_modules", "dist", "build", "coverage", ".vercel", ".turbo"]);
const scannedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".ps1",
  ".py",
  ".sql",
  ".example",
]);

const allowContextPaths = [
  /^docs[\\/]/,
  /^README\.md$/,
  /^SUPABASE_SETUP\.md$/,
  /^pnpm-lock\.yaml$/,
  /^scripts[\\/]/,
  /^data[\\/]/,
  /^lib[\\/]camera[\\/]/,
  /^lib[\\/]device[\\/]/,
  /^lib[\\/]permissions[\\/]/,
  /^lib[\\/]licenses[\\/]/,
  /^lib[\\/]github-radar[\\/]/,
  /^lib[\\/]research[\\/]/,
  /^lib[\\/]env\.ts$/,
  /^src[\\/]config[\\/]securityConfig\.ts$/,
  /^src[\\/]app[\\/]api[\\/]/,
  /^app[\\/]api[\\/]/,
  /^python[\\/]/,
  /^supabase[\\/]migrations[\\/]/,
  /^sonara-industries[\\/]backups[\\/]/,
  /^sonara-industries[\\/]docs[\\/]/,
  /^sonara-industries[\\/]apps[\\/]api[\\/]/,
  /^sonara-industries[\\/]apps[\\/]web[\\/]app[\\/]legal[\\/]/,
  /^sonara-industries[\\/]apps[\\/]web[\\/]components[\\/]legal[\\/]/,
];

const serverOnlyPaths = [
  /^lib[\\/]supabaseAdmin\.ts$/,
  /^lib[\\/]supabase[\\/]admin\.ts$/,
  /^lib[\\/]auth[\\/]/,
  /^lib[\\/]email[\\/]/,
  /^lib[\\/]support[\\/]support-actions\.ts$/,
  /^lib[\\/]support[\\/]support-email\.ts$/,
  /^src[\\/]app[\\/]api[\\/]/,
  /^app[\\/]api[\\/]/,
  /^app[\\/].*[\\/]route\.(ts|js)$/,
];

const clientFacingPaths = [
  /^components[\\/]/,
  /^src[\\/]components[\\/]/,
  /^app[\\/](?!api[\\/]).*\.(tsx|jsx)$/,
  /^src[\\/]app[\\/](?!api[\\/]).*\.(tsx|jsx)$/,
  /^pages[\\/]/,
  /^src[\\/]pages[\\/]/,
  /^public[\\/]/,
];

const serverSecretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "SONARA_CRON_SECRET",
];

const secretValuePatterns = [
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /\bsk_live_[A-Za-z0-9]{16,}/,
  /\bsk_test_[A-Za-z0-9]{16,}/,
  /\bwhsec_[A-Za-z0-9]{16,}/,
  /\bre_[A-Za-z0-9_-]{24,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?(sb_secret_[A-Za-z0-9_-]+)/i,
];

const publicSecretNamePattern = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|TOKEN|API_KEY)[A-Z0-9_]*/i;

const unsafeFeaturePatterns = [
  /\bguaranteed revenue\b/i,
  /\bfully autonomous\b/i,
  /\bjailbreak\b/i,
  /\buncensored\b/i,
  /\bwatch any movie free\b/i,
  /\bpiracy\b/i,
  /\bspy\b/i,
  /\bsurveillance\b/i,
  /\btactical\b/i,
  /\bmedical diagnosis\b/i,
  /\blegal advice\b/i,
  /\btax advice\b/i,
  /\binvestment advice\b/i,
  /\bemergency dispatch\b/i,
  /\bhidden scraping\b/i,
  /\bno data leaks\b/i,
  /\bhack(?:ing|s|ed)?\b/i,
];

const safetyContextPattern =
  /\b(blocked|disallowed|forbidden|restricted|review|required|requires|no|not|never|without|avoid|prevent|policy|safety|risk|unsafe)\b/i;

// Fixture expectations:
// - Client service role reference must fail.
// - Docs warning that keys are server-only must pass.
// - Policy blocked-use wording such as "no surveillance" must pass.
// - Real-looking secret values must fail anywhere.
// - NEXT_PUBLIC secret-like env names must fail outside approved scanner/docs context.

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;

    const relPath = path.relative(root, fullPath);
    const ext = path.extname(entry.name);

    if (scannedExtensions.has(ext) || entry.name === ".env.example" || entry.name.endsWith(".env.example")) {
      files.push(relPath);
    }
  }

  return files;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function matchesAny(filePath, patterns) {
  const normalized = normalizePath(filePath);
  return patterns.some((pattern) => pattern.test(normalized));
}

function hasServerOnlyImport(text) {
  return /import\s+["']server-only["'];?/.test(text);
}

function hasUseClientDirective(text) {
  return /["']use client["'];?/.test(text.slice(0, 300));
}

function getLineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function contextAround(text, index, size = 180) {
  return text.slice(Math.max(0, index - size), Math.min(text.length, index + size));
}

function hasRealSecretValue(text) {
  return secretValuePatterns.some((pattern) => pattern.test(text));
}

const violations = [];

for (const filePath of walk(root)) {
  const absPath = path.join(root, filePath);
  let text = "";

  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    continue;
  }

  const allowedContext = matchesAny(filePath, allowContextPaths);
  const serverOnly = hasServerOnlyImport(text) || matchesAny(filePath, serverOnlyPaths);
  const useClient = hasUseClientDirective(text);
  const clientFacing = useClient || matchesAny(filePath, clientFacingPaths);

  if (hasRealSecretValue(text)) {
    violations.push(`${filePath}: real-looking secret value found`);
    continue;
  }

  const publicSecretMatch = text.match(publicSecretNamePattern);
  if (publicSecretMatch && !allowedContext) {
    violations.push(`${filePath}: public secret-like env name found`);
    continue;
  }

  for (const name of serverSecretNames) {
    const index = text.indexOf(name);
    if (index === -1) continue;

    if (clientFacing && !serverOnly && !allowedContext) {
      violations.push(`${filePath}:${getLineNumber(text, index)}: server-only env marker found in client/public surface`);
      break;
    }
  }

  for (const pattern of unsafeFeaturePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const context = contextAround(text, match.index);
    const safetyContext = safetyContextPattern.test(context);

    if (!allowedContext && clientFacing && !safetyContext) {
      violations.push(`${filePath}:${getLineNumber(text, match.index)}: unsafe public claim or risky feature wording found`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("Risky feature or secret boundary violations found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Risky feature check passed.");
