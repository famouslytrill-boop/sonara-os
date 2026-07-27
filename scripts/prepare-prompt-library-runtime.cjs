"use strict";

const fs = require("node:fs");
const path = require("node:path");

preparePromptEngine();
prepareSupabaseVerifierCompatibility();
prepareSecurityHotfixCompatibility();
prepareRouteRegistry();
prepareEcosystemManifest();

console.log("Prompt Library engine, verifier, security hotfix, and route markers prepared for transformed runtime");

function preparePromptEngine() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-prompt-library.cjs");
  let source = fs.readFileSync(filePath, "utf8");
  if (source.includes("const protectedVariable = variables.find(isProtectedVariableName);")) return;

  const marker = `  const content = String(source.content || "");
  const safety = reviewPromptContent(content, source);
  if (!safety.ok) return { ok: false, code: "prompt_blocked", safety };
  if (content.length > MAX_TEMPLATE_LENGTH) return { ok: false, code: "template_too_large" };

  const variables = extractVariables(content);`;
  if (!source.includes(marker)) throw new Error("Prompt Library render validation marker not found");

  const replacement = `  const content = String(source.content || "");
  const variables = extractVariables(content);
  const protectedVariable = variables.find(isProtectedVariableName);
  if (protectedVariable) return { ok: false, code: "protected_variable_name", variable: protectedVariable };
  const safety = reviewPromptContent(content, source);
  if (!safety.ok) return { ok: false, code: "prompt_blocked", safety };
  if (content.length > MAX_TEMPLATE_LENGTH) return { ok: false, code: "template_too_large" };`;

  source = source.replace(marker, replacement);
  fs.writeFileSync(filePath, source);
}

function prepareSupabaseVerifierCompatibility() {
  const filePath = path.join(__dirname, "..", "scripts", "verify-supabase-contract.mjs");
  let source = fs.readFileSync(filePath, "utf8");

  const historicalNote = "// Historical baseline: expected 135 canonical tables before Prompt Library added 10 organization-scoped tables.";
  const countMarker = 'if (DATABASE_TABLES.length !== 145) fail(`expected 145 canonical tables, found ${DATABASE_TABLES.length}`);';
  if (!source.includes(historicalNote)) {
    if (!source.includes(countMarker)) throw new Error("Prompt Library Supabase verifier count marker not found");
    source = source.replace(countMarker, `${historicalNote}\n${countMarker}`);
  }

  if (source.includes("const marketIntelligenceMigrationPath")) {
    source = ensureConstArrayValue(source, "contractSql", "marketIntelligenceMigrationPath", "promptLibraryMigrationPath");
  }
  source = ensureConstArrayValue(source, "contractSql", "promptLibraryMigrationPath");

  fs.writeFileSync(filePath, source);
}

function prepareSecurityHotfixCompatibility() {
  const filePath = path.join(__dirname, "..", "scripts", "apply-prompt-library-security-hotfix.cjs");
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of [
    "const promptLibrarySqlNormalized =",
    'ensureConstArrayValue(source, "contractSql", "promptLibrarySecurityMigrationPath")',
    "function ensureConstArrayValue(source, constantName, value)"
  ]) {
    if (!source.includes(marker)) throw new Error(`Prompt Library security hotfix idempotency marker missing: ${marker}`);
  }
}

function prepareRouteRegistry() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(filePath, "utf8");

  source = addToNamedArray(source, "PUBLIC_ROUTES", "/prompt-library");
  source = addToNamedArray(source, "ADMIN_ROUTES", "/admin/prompt-library");
  source = addToProductArray(source, "business_builder", "/business-builder/prompts");
  source = addToProductArray(source, "creator_studio", "/creator-studio/prompts");
  source = addToProductArray(source, "growth_studio", "/growth-studio/prompts");

  fs.writeFileSync(filePath, source);
}

function prepareEcosystemManifest() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-ecosystem-manifest.cjs");
  let source = fs.readFileSync(filePath, "utf8");

  source = addToCompanyRoutes(source, "business_builder", "/business-builder/prompts");
  source = addToCompanyRoutes(source, "creator_studio", "/creator-studio/prompts");
  source = addToCompanyRoutes(source, "growth_studio", "/growth-studio/prompts");
  source = addToAdminControlPlaneRoutes(source, "/admin/prompt-library");

  fs.writeFileSync(filePath, source);
}

function ensureConstArrayValue(source, constantName, value, beforeValue) {
  const pattern = new RegExp(`(const\\s+${escapeRegExp(constantName)}\\s*=\\s*\\[)([^\\]]*)(\\])`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Prompt Library ${constantName} array not found`);

  const items = match[2].split(",").map((item) => item.trim()).filter(Boolean);
  if (items.includes(value)) return source;

  const insertAt = beforeValue ? items.indexOf(beforeValue) : -1;
  if (insertAt >= 0) items.splice(insertAt, 0, value);
  else items.push(value);

  return source.replace(pattern, (_, opening, _body, closing) => `${opening}${items.join(", ")}${closing}`);
}

function addToNamedArray(source, constantName, value) {
  if (source.includes(`"${value}"`)) return source;
  const pattern = new RegExp(`(const\\s+${escapeRegExp(constantName)}\\s*=\\s*\\[)([\\s\\S]*?)(\\n\\];)`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Prompt Library ${constantName} array not found`);
  return source.replace(pattern, (_, opening, body, closing) => `${opening}${appendArrayValue(body, value, "  ")}${closing}`);
}

function addToProductArray(source, productKey, value) {
  if (source.includes(`"${value}"`)) return source;
  const pattern = new RegExp(`(${escapeRegExp(productKey)}\\s*:\\s*\\[)([\\s\\S]*?)(\\n\\s*\\])`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Prompt Library ${productKey} product array not found`);
  return source.replace(pattern, (_, opening, body, closing) => `${opening}${appendArrayValue(body, value, "    ")}${closing}`);
}

function addToCompanyRoutes(source, companyKey, value) {
  if (companyBlockContains(source, companyKey, value)) return source;
  const companyPattern = new RegExp(`(key:\\s*"${escapeRegExp(companyKey)}"[\\s\\S]*?routes:\\s*\\[)([^\\]]*)(\\])`);
  const match = source.match(companyPattern);
  if (!match) throw new Error(`Prompt Library ${companyKey} ecosystem routes not found`);
  return source.replace(companyPattern, (_, opening, body, closing) => `${opening}${appendInlineArrayValue(body, value)}${closing}`);
}

function addToAdminControlPlaneRoutes(source, value) {
  const pattern = /(adminControlPlane:\s*\{[\s\S]*?routes:\s*\[)([^\]]*)(\])/;
  const match = source.match(pattern);
  if (!match) throw new Error("Prompt Library ecosystem admin control-plane routes not found");
  if (match[2].includes(`"${value}"`)) return source;
  return source.replace(pattern, (_, opening, body, closing) => `${opening}${appendInlineArrayValue(body, value)}${closing}`);
}

function companyBlockContains(source, companyKey, value) {
  const pattern = new RegExp(`key:\\s*"${escapeRegExp(companyKey)}"[\\s\\S]*?routes:\\s*\\[([^\\]]*)\\]`);
  const match = source.match(pattern);
  return Boolean(match && match[1].includes(`"${value}"`));
}

function appendArrayValue(body, value, indent) {
  const trimmed = body.replace(/\s+$/, "");
  const suffix = trimmed.trim().endsWith(",") ? "" : ",";
  return `${trimmed}${suffix}\n${indent}"${value}"`;
}

function appendInlineArrayValue(body, value) {
  const trimmed = body.trimEnd();
  const suffix = trimmed.trim().endsWith(",") || !trimmed.trim() ? "" : ",";
  const spacing = trimmed && !/\s$/.test(trimmed) ? " " : "";
  return `${trimmed}${suffix}${spacing}"${value}"`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
