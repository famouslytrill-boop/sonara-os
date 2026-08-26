// Assert that the Supabase project this pipeline is about to migrate is the
// intended production project, and that it is actually running.
//
// Why this exists: the organization contains a second project literally named
// "sonara-industries-prod" which is INACTIVE (paused), while the project the
// repository pins carries a personal-account name. Nothing in the pipeline
// checked which project it was pointed at, or whether that project was healthy,
// before applying migrations to it. See CRIT-2 in
// docs/audits/2026-07-27-ENGINEERING_AUDIT.md.
//
// Requires SUPABASE_ACCESS_TOKEN (already present in the deploy workflow) and
// SUPABASE_PROJECT_ID. Reads only; changes nothing.

const EXPECTED_PROJECT_REF = "yqncsonkxgwhcxedgevk";
const MANAGEMENT_API = "https://api.supabase.com/v1/projects";

const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectId = String(process.env.SUPABASE_PROJECT_ID || "").trim();
// Set this once the project has been renamed, to make the name check binding.
const expectedName = String(process.env.SONARA_EXPECTED_SUPABASE_PROJECT_NAME || "").trim();

const failures = [];
const notes = [];

if (!accessToken) failures.push("SUPABASE_ACCESS_TOKEN is not configured");
if (!projectId) failures.push("SUPABASE_PROJECT_ID is not configured");

if (!failures.length) {
  if (projectId !== EXPECTED_PROJECT_REF) {
    failures.push(
      `SUPABASE_PROJECT_ID is ${projectId}, but this repository is pinned to ${EXPECTED_PROJECT_REF}. ` +
        "Repointing production is a deliberate migration, not a configuration change: update " +
        "EXPECTED_PROJECT_REF here and in scripts/verify-supabase-contract.mjs in the same commit."
    );
  }

  const response = await fetch(MANAGEMENT_API, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).catch((error) => {
    failures.push(`could not reach the Supabase Management API: ${error.message}`);
    return undefined;
  });

  if (response && !response.ok) {
    failures.push(`Supabase Management API returned ${response.status}`);
  } else if (response) {
    const projects = await response.json().catch(() => []);
    const project = Array.isArray(projects)
      ? projects.find((entry) => entry?.id === projectId || entry?.ref === projectId)
      : undefined;

    if (!project) {
      failures.push(`project ${projectId} is not visible to this access token`);
    } else {
      if (project.status !== "ACTIVE_HEALTHY") {
        failures.push(
          `project ${projectId} ("${project.name}") reports status ${project.status}, not ACTIVE_HEALTHY. ` +
            "Refusing to migrate or deploy against a project that is not running."
        );
      }

      if (expectedName && project.name !== expectedName) {
        failures.push(
          `project ${projectId} is named "${project.name}", but SONARA_EXPECTED_SUPABASE_PROJECT_NAME is "${expectedName}"`
        );
      } else if (!expectedName) {
        notes.push(
          `project name is "${project.name}" (not asserted). Set SONARA_EXPECTED_SUPABASE_PROJECT_NAME ` +
            "to make this binding once the project has been renamed."
        );
      }

      // A paused sibling project whose name implies production is a standing
      // trap: it is the project an operator would reach for in an incident.
      const misleadingSiblings = (Array.isArray(projects) ? projects : []).filter(
        (entry) =>
          entry?.id !== projectId &&
          String(entry?.name || "").toLowerCase().includes("prod") &&
          entry?.status !== "ACTIVE_HEALTHY"
      );

      for (const sibling of misleadingSiblings) {
        notes.push(
          `WARNING: project "${sibling.name}" (${sibling.id}) is named like production but is ${sibling.status}. ` +
            "Archive or rename it so it cannot be mistaken for the live project."
        );
      }
    }
  }
}

// Leaked-password protection.
//
// Supabase Auth can check submitted passwords against HaveIBeenPwned and refuse
// known-breached ones. The security advisor reported it disabled on 2026-07-27.
// For a product taking payment that is worth having on, and worth keeping on --
// it is a dashboard toggle, so nothing in the repository would otherwise notice
// if it were switched off again.
//
// This reports state on every deploy and becomes binding once
// SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true is set, the same ratchet used
// for the project name. It is deliberately not a hard failure by default,
// because turning a currently-disabled setting into a deploy blocker would stop
// production releases for a configuration change nobody had agreed to yet.
const requireLeakedPasswordProtection =
  String(process.env.SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION || "").toLowerCase() === "true";

if (!failures.length && accessToken && projectId) {
  const authResponse = await fetch(`${MANAGEMENT_API}/${projectId}/config/auth`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).catch(() => undefined);

  if (!authResponse || !authResponse.ok) {
    // A read that did not answer is not a setting that is on.
    //
    // This was a note in every case, including with the ratchet set -- so once
    // the owner set SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true believing the
    // deploy now enforced it, a transient failure or a rotated token quietly
    // downgraded it back to unenforced and the deploy still passed. The ratchet
    // turned "disabled" into a failure and left "we could not tell" as a pass,
    // which is the recurring defect in this repository wearing a padlock.
    const message =
      `could not read auth configuration (${authResponse ? authResponse.status : "request failed"}); ` +
      "leaked-password protection not checked";
    if (requireLeakedPasswordProtection) {
      failures.push(
        `${message}. SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true means this must be confirmed on every ` +
          "deploy, and an unread answer is not a confirmation."
      );
    } else {
      notes.push(message);
    }
  } else {
    const authConfig = await authResponse.json().catch(() => undefined);
    const enabled = authConfig?.password_hibp_enabled;

    if (enabled === true) {
      notes.push("leaked-password protection is enabled");
    } else if (enabled === false) {
      const message =
        "leaked-password protection is DISABLED. Enable it under Authentication -> Providers -> Password " +
        "(Supabase checks submitted passwords against HaveIBeenPwned). " +
        "Set SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true once enabled to keep it that way.";
      if (requireLeakedPasswordProtection) failures.push(message);
      else notes.push(`WARNING: ${message}`);
    } else {
      // Do not guess. If the field is missing the API shape has changed, and
      // silently passing would be worse than saying so.
      //
      // And once the ratchet is set, saying so is not enough either: the whole
      // point of the ratchet is that the setting cannot drift back off without
      // the deploy noticing, and a field this check can no longer find is
      // indistinguishable from a setting it can no longer see.
      const message =
        "auth configuration did not include password_hibp_enabled; the Management API shape may have changed, " +
        "so leaked-password protection could not be confirmed either way";
      if (requireLeakedPasswordProtection) {
        failures.push(
          `${message}. The ratchet is set, so this fails rather than passing on an answer nobody has.`
        );
      } else {
        notes.push(message);
      }
    }
  }
}

for (const note of notes) console.log(`[note] ${note}`);

if (failures.length) {
  for (const failure of failures) console.error(`[fail] ${failure}`);
  process.exit(1);
}

console.log(`Production project identity verified: ${projectId} is ACTIVE_HEALTHY and matches the pinned reference.`);
