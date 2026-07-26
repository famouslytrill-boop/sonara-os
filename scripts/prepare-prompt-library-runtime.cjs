"use strict";

const fs = require("node:fs");
const path = require("node:path");

preparePromptEngine();
prepareRouteRegistry();
prepareEcosystemManifest();

console.log("Prompt Library engine and route markers prepared for transformed runtime");

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
