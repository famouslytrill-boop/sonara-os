#!/usr/bin/env node

const EXPECTED_PROJECT_REF = "yqncsonkxgwhcxedgevk";
const EXPECTED_SITE_URL = "https://sonaraindustries.com";
const EXPECTED_CALLBACK = "https://sonaraindustries.com/auth/callback";
const MANAGEMENT_API = "https://api.supabase.com/v1/projects";

const projectRef = String(process.env.SUPABASE_PROJECT_ID || "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const enable = process.argv.includes("--enable");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!accessToken) fail("SUPABASE_ACCESS_TOKEN is required.");
if (projectRef !== EXPECTED_PROJECT_REF) {
  fail(`Refusing to touch project "${projectRef || "missing"}"; expected "${EXPECTED_PROJECT_REF}".`);
}

async function request(method, body) {
  const response = await fetch(
    `${MANAGEMENT_API}/${encodeURIComponent(projectRef)}/config/auth`,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000)
    }
  ).catch((error) => fail(`Supabase Management API request failed: ${error?.name || "network_error"}.`));

  if (!response.ok) fail(`Supabase Management API returned HTTP ${response.status}.`);
  const json = await response.json().catch(() => null);
  if (!json || typeof json !== "object") fail("Supabase Management API returned invalid JSON.");
  return json;
}

function normalizedAllowList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const before = await request("GET");
const clientIdPresent = Boolean(String(before.external_google_client_id || "").trim());
const secretPresent = Boolean(String(before.external_google_secret || "").trim());
const siteUrlMatches = String(before.site_url || "").replace(/\/+$/, "") === EXPECTED_SITE_URL;
const callbackAllowed = normalizedAllowList(before.uri_allow_list).includes(EXPECTED_CALLBACK);

console.log("Google provider preflight:");
console.log(`- project: ${EXPECTED_PROJECT_REF}`);
console.log(`- enabled: ${before.external_google_enabled === true ? "yes" : "no"}`);
console.log(`- client id: ${clientIdPresent ? "present" : "missing"}`);
console.log(`- client secret: ${secretPresent ? "present" : "missing"}`);
console.log(`- site URL: ${siteUrlMatches ? "correct" : "mismatch"}`);
console.log(`- application callback allow-listed: ${callbackAllowed ? "yes" : "no"}`);

if (!clientIdPresent || !secretPresent) {
  fail("Stored Google OAuth client credentials are incomplete; no configuration was changed.");
}
if (!siteUrlMatches) {
  fail("Supabase Auth Site URL is not the canonical SONARA production origin; no configuration was changed.");
}
if (!callbackAllowed) {
  fail("SONARA /auth/callback is not explicitly allow-listed; no configuration was changed.");
}

if (!enable) {
  console.log("Inspection only. Pass --enable to enable the already-configured Google provider.");
  process.exit(0);
}

if (before.external_google_enabled !== true) {
  await request("PATCH", { external_google_enabled: true });
}

const after = await request("GET");
if (after.external_google_enabled !== true) {
  fail("Supabase accepted the request but Google still reads disabled.");
}

console.log("Google provider postflight:");
console.log("- enabled: yes");
console.log("- credentials: retained in Supabase Auth");
console.log("- changed fields requested by this operation: external_google_enabled only");
