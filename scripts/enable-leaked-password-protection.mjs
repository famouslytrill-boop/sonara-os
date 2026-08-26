// Turn on Supabase's leaked-password protection, and confirm it from the server.
//
// docs/owner/OWNER-STEPS.md item 2 has been "click Authentication -> Providers ->
// Password in the dashboard" since 27 July 2026. It is one setting, it is one
// API field, and a dashboard path somebody has to find is a step that stays
// open. This is that step as a command.
//
// It changes exactly one field: password_hibp_enabled. Supabase then checks
// every submitted password against HaveIBeenPwned and refuses known-breached
// ones, across every path Supabase Auth serves -- which is wider than
// lib/sonara-leaked-password.cjs can cover, because that only sees the paths
// this application owns.
//
// **Reports by default and changes nothing.** Pass --enable to write. Running
// this by accident does nothing, which is the right default for a command that
// edits a live project's authentication configuration.
//
//   node scripts/enable-leaked-password-protection.mjs            # report
//   node scripts/enable-leaked-password-protection.mjs --enable   # turn it on
//
// Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID, the same two the deploy
// workflow already has.

const EXPECTED_PROJECT_REF = "yqncsonkxgwhcxedgevk";
const MANAGEMENT_API = "https://api.supabase.com/v1/projects";
const FIELD = "password_hibp_enabled";

const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectId = String(process.env.SUPABASE_PROJECT_ID || "").trim();
const apply = process.argv.includes("--enable");

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exit(1);
}

if (!accessToken) fail("SUPABASE_ACCESS_TOKEN is not set. It is the same token the deploy workflow uses.");
if (!projectId) fail("SUPABASE_PROJECT_ID is not set.");

// The same pin scripts/verify-production-project-identity.mjs applies, for the
// same reason: this organization contains a second project named like
// production, and a setting flipped on the wrong one is worse than one nobody
// flipped -- it reads as done.
if (projectId !== EXPECTED_PROJECT_REF) {
  fail(
    `SUPABASE_PROJECT_ID is ${projectId}, and this repository is pinned to ${EXPECTED_PROJECT_REF}. ` +
      "Refusing to change authentication configuration on a project this repository is not pinned to."
  );
}

const authUrl = `${MANAGEMENT_API}/${projectId}/config/auth`;
const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

async function readSetting(label) {
  const response = await fetch(authUrl, { headers }).catch((error) => {
    fail(`could not reach the Supabase Management API while ${label}: ${error.message}`);
  });
  if (!response.ok) {
    fail(`could not read auth configuration while ${label} (HTTP ${response.status}).`);
  }
  const config = await response.json().catch(() => undefined);
  if (!config || !Object.prototype.hasOwnProperty.call(config, FIELD)) {
    // Absent is not false. If the field has gone, the API shape changed, and
    // reporting "disabled" would send somebody to turn on something that may
    // already be on under another name.
    fail(
      `auth configuration did not include ${FIELD} while ${label}. The Management API shape may have changed; ` +
        "check the Supabase dashboard by hand rather than trusting this command."
    );
  }
  return config[FIELD] === true;
}

const before = await readSetting("reading the current setting");

if (before) {
  console.log(`[ok] Leaked-password protection is already on for ${projectId}.`);
  console.log("");
  console.log("Nothing to do here. The remaining half of OWNER-STEPS item 2 is the ratchet:");
  console.log("  set SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true in Vercel, for Production.");
  console.log("Until that is set, a deploy passes whether this is on or off, so nothing would");
  console.log("notice it being switched back off.");
  process.exit(0);
}

if (!apply) {
  console.log(`[note] Leaked-password protection is OFF for ${projectId}.`);
  console.log("");
  console.log("This run changed nothing. To turn it on:");
  console.log("  node scripts/enable-leaked-password-protection.mjs --enable");
  console.log("");
  console.log("Then set SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true in Vercel for Production,");
  console.log("which is what makes a later deploy fail if it is ever switched back off.");
  process.exit(0);
}

const patched = await fetch(authUrl, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ [FIELD]: true })
}).catch((error) => {
  fail(`the change could not be sent: ${error.message}`);
});

if (!patched.ok) {
  const detail = await patched.text().catch(() => "");
  fail(`Supabase refused the change (HTTP ${patched.status}). ${detail.slice(0, 300)}`);
}

// Read it back rather than trusting the response to the write. A 200 on a PATCH
// says the request was accepted, not that the setting now reads true -- and
// this whole file exists because a setting nobody confirmed is a setting nobody
// knows about.
const after = await readSetting("confirming the change");

if (!after) {
  fail(
    `Supabase accepted the change but ${FIELD} still reads false. Do not treat this as done; ` +
      "check the dashboard under Authentication -> Providers -> Password."
  );
}

console.log(`[ok] Leaked-password protection is now ON for ${projectId}, confirmed by reading it back.`);
console.log("");
console.log("One thing left, and it is the half people skip:");
console.log("  set SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true in Vercel, for Production.");
console.log("");
console.log("Until that is set the deploy only warns, so this could be switched off again and");
console.log("every release would stay green. With it set, a deploy fails if the setting is off --");
console.log("and, since 19 August 2026, also if the setting cannot be read at all.");
