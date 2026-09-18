#!/usr/bin/env node

const requireProvider = process.argv.includes("--require");
const read = (names) => {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
};

const envUrl = read(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]).replace(/\/+$/, "");
const envPublicKey = read([
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
]);
const site = read(["NEXT_PUBLIC_SITE_URL"]).replace(/\/+$/, "");
const projectRef = read(["SUPABASE_PROJECT_ID"]);
const managementToken = read(["SUPABASE_ACCESS_TOKEN"]);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function usableEnvValue(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && !/^\[SENSITIVE\]$/i.test(normalized);
}

async function managementPublicAuthConfig() {
  if (!projectRef || !managementToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetch(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/api-keys?reveal=true`,
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );
  } catch (error) {
    fail(
      `Supabase Management API keys could not be reached: ${error?.name === "AbortError" ? "timeout" : "network error"}.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    fail(`Supabase Management API key lookup returned HTTP ${response.status}.`);
  }

  const keys = await response.json().catch(() => null);
  if (!Array.isArray(keys)) fail("Supabase Management API key lookup did not return a key list.");

  // Prefer the modern low-privilege key. During Supabase's 2026 transition,
  // legacy anon remains a valid fallback. Secret/service-role keys are never
  // candidates for this public Auth settings probe.
  const selected =
    keys.find((key) =>
      key?.type === "publishable"
      && key?.disabled !== true
      && typeof key?.api_key === "string"
      && key.api_key.startsWith("sb_publishable_"))
    || keys.find((key) =>
      key?.type === "legacy"
      && key?.disabled !== true
      && (key?.name === "anon" || key?.id === "anon")
      && typeof key?.api_key === "string"
      && key.api_key.length > 20);

  if (!selected) {
    fail("Supabase Management API returned no active publishable or legacy anon key for the project.");
  }

  const managedUrl = `https://${projectRef}.supabase.co`;
  if (usableEnvValue(envUrl) && envUrl !== managedUrl) {
    fail("Supabase environment URL does not match SUPABASE_PROJECT_ID; refusing to verify a different project.");
  }

  return { url: managedUrl, publicKey: selected.api_key, source: "management_api" };
}

const managed = await managementPublicAuthConfig();
const url = managed?.url || (usableEnvValue(envUrl) ? envUrl : "");
const publicKey = managed?.publicKey || (usableEnvValue(envPublicKey) ? envPublicKey : "");

if (!url || !publicKey) {
  if (requireProvider) {
    fail(
      "Supabase public Auth configuration is unavailable. Provide SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID, or an active publishable/anon key."
    );
  }
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
    headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
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
console.log(`- Public Auth key source: ${managed?.source || "application_environment"}`);
console.log("- OAuth mode: server-side PKCE");
console.log("- Google client credentials: owned by Supabase Auth, not duplicated into SONARA runtime");
