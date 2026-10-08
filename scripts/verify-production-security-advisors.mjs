// Fail-closed production Supabase security-advisor gate.
//
// Runs only after reviewed production migrations have been applied and the
// complete production database verifier has passed. It reads the hosted
// advisor through the Supabase Management API and changes nothing.
//
// Policy:
// - every WARN/ERROR security lint blocks deployment;
// - leaked-password protection may remain a warning only while the existing
//   SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION ratchet is not enabled;
// - INFO findings (notably intentionally closed RLS tables with no policy)
//   are reported, not converted into fake policies merely to make a dashboard
//   green.
const EXPECTED_PROJECT_REF = "yqncsonkxgwhcxedgevk";
const MANAGEMENT_API = "https://api.supabase.com/v1/projects";

const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectId = String(process.env.SUPABASE_PROJECT_ID || "").trim();
const requireLeakedPasswordProtection =
  String(process.env.SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION || "").toLowerCase() === "true";

function fail(message) {
  console.error("[fail] " + message);
  process.exitCode = 1;
}

if (!accessToken) fail("SUPABASE_ACCESS_TOKEN is not configured");
if (!projectId) fail("SUPABASE_PROJECT_ID is not configured");
if (projectId && projectId !== EXPECTED_PROJECT_REF) {
  fail(`SUPABASE_PROJECT_ID is ${projectId}; repository is pinned to ${EXPECTED_PROJECT_REF}`);
}

if (!process.exitCode) {
  const response = await fetch(`${MANAGEMENT_API}/${projectId}/advisors/security`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  }).catch(() => undefined);

  if (!response || !response.ok) {
    fail(
      `could not read production Supabase security advisor (${response ? response.status : "request failed"}); ` +
      "an unread security gate is not a passing gate"
    );
  } else {
    const body = await response.json().catch(() => undefined);
    const lints = Array.isArray(body?.lints)
      ? body.lints
      : Array.isArray(body?.result?.lints)
        ? body.result.lints
        : null;

    if (!lints) {
      fail("security-advisor response did not include a lints array; Management API shape may have changed");
    } else {
      let warnedLeakedPassword = false;
      const blocking = [];

      for (const lint of lints) {
        const name = String(lint?.name || "unknown_security_lint");
        const level = String(lint?.level || "").toUpperCase();
        const count = Number(lint?.count ?? (Array.isArray(lint?.findings) ? lint.findings.length : 0));

        if (level === "INFO") {
          console.log(`[info] ${name}: ${Number.isFinite(count) ? count : "unknown"} finding(s)`);
          continue;
        }

        if (name === "auth_leaked_password_protection" && !requireLeakedPasswordProtection) {
          warnedLeakedPassword = true;
          console.log(
            "[warn] auth_leaked_password_protection remains advisory until " +
            "SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true; enable the Supabase setting before setting the ratchet"
          );
          continue;
        }

        if (level === "WARN" || level === "WARNING" || level === "ERROR" || level === "CRITICAL") {
          blocking.push({ name, level, count: Number.isFinite(count) ? count : null });
        }
      }

      if (blocking.length) {
        for (const item of blocking) {
          fail(
            `production Supabase security advisor: ${item.level} ${item.name}` +
            (item.count == null ? "" : ` (${item.count} finding(s))`)
          );
        }
      } else if (!process.exitCode) {
        console.log(
          `Production Supabase security advisor verified: no blocking WARN/ERROR findings` +
          (warnedLeakedPassword ? "; leaked-password protection remains explicitly unratcheted" : "") +
          "."
        );
      }
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
