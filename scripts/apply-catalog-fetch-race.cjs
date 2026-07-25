"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "server.js");
let source = fs.readFileSync(file, "utf8");

const marker = "const timeoutResult = Object.freeze({ sonaraCatalogTimeout: true });";
if (source.includes(marker)) {
  console.log("SONARA catalog fetch race already applied");
  process.exit(0);
}

const current = `async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  const timeoutMs = process.env.NODE_ENV === "test" ? 100 : 1200;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetch(\`${config.url}/rest/v1/${table}${query}\`, {
      headers: supabaseHeaders(config),
      signal: controller.signal
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } finally {
    clearTimeout(timeout);
  }
}`;

const replacement = `async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  const timeoutMs = process.env.NODE_ENV === "test" ? 100 : 1200;
  const controller = new AbortController();
  const timeoutResult = Object.freeze({ sonaraCatalogTimeout: true });
  let timeout;
  const request = Promise.resolve()
    .then(() => fetch(\`${config.url}/rest/v1/${table}${query}\`, {
      headers: supabaseHeaders(config),
      signal: controller.signal
    }))
    .catch(() => undefined);
  const deadline = new Promise((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(timeoutResult);
    }, timeoutMs);
    timeout.unref?.();
  });
  const response = await Promise.race([request, deadline]);
  clearTimeout(timeout);
  if (response === timeoutResult || !response?.ok) return { ok: false, rows: [] };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}`;

if (!source.includes(current)) {
  throw new Error("Catalog fetch timeout anchor is missing");
}

source = source.replace(current, replacement);
fs.writeFileSync(file, source);
console.log("SONARA catalog fetch race applied");
