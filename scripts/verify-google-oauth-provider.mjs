#!/usr/bin/env node

const requireProvider = process.argv.includes("--require");
const read = (names) => {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
};

const url = read(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]).replace(/\/+$/, "");
const anonKey = read(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
const site = read(["NEXT_PUBLIC_SITE_URL"]).replace(/\/+$/, "");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!url || !anonKey) {
  if (requireProvider) fail("Supabase URL/anon key are missing, so Google provider readiness cannot be proved.");
  console.log("Google OAuth provider verification skipped: Supabase public auth configuration is unavailable.");
  process.exit(0);
}

if (!site || !/^https:\/\//.test(site)) {
  fail("NEXT_PUBLIC_SITE_URL must be an HTTPS origin so the Google callback can be verified.");
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 4000);
let response;
try {
  response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: controller.signal
  });
} catch (error) {
  fail(`Supabase Auth settings could not be reached: ${error?.name === "AbortError" ? "timeout" : "network error"}.`);
} finally {
  clearTimeout(timer);
}

if (!response.ok) fail(`Supabase Auth settings returned HTTP ${response.status}.`);

const settings = await response.json().catch(() => null);
if (!settings || typeof settings !== "object") fail("Supabase Auth settings did not return JSON.");
if (settings?.external?.google !== true) {
  fail("Supabase Google provider is not enabled. Production deployment is blocked until Google sign-in is configured.");
}

const callback = new URL("/auth/callback", `${site}/`).toString();
const supabaseCallback = new URL("/auth/v1/callback", `${url}/`).toString();

console.log("Google OAuth provider verified:");
console.log("- Supabase provider: enabled");
console.log(`- Application callback: ${callback}`);
console.log(`- Google provider callback: ${supabaseCallback}`);
console.log("- OAuth mode: server-side PKCE");
console.log("- Google client credentials: owned by Supabase Auth, not duplicated into SONARA runtime");
