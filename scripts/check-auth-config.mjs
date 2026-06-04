import { exists, failIfIssues, listFiles, read, relative } from "./check-utils.mjs";
import fs from "node:fs";

const issues = [];

const requiredFiles = [
  "packages/web/src/app/login/page.ts",
  "packages/web/src/app/signup/page.ts",
  "packages/web/src/app/auth/callback/page.ts",
  "packages/web/src/app/auth/auth-code-error/page.ts",
  "packages/web/src/app/settings/auth-status/page.ts",
  "packages/web/src/app/admin/auth-status/page.ts",
  "packages/web/src/app/admin/setup/page.ts",
  "packages/web/src/app/admin/launch-readiness/page.ts",
  "packages/web/src/components/auth/AuthEnvironmentNotice.tsx",
  "packages/web/src/components/auth/AuthProviderStatus.tsx",
  "packages/web/src/components/auth/AuthMethodTabs.tsx",
  "packages/web/src/components/auth/LoginPanel.tsx",
  "packages/web/src/lib/public-env.ts",
  "packages/web/src/lib/env-status.ts",
  "packages/web/src/lib/auth/auth-actions.ts",
  "packages/web/src/lib/auth/auth-error-messages.ts",
  "packages/web/src/lib/auth/get-site-url.ts"
];

for (const filePath of requiredFiles) {
  if (!exists(filePath)) {
    issues.push(`Missing auth config file: ${filePath}`);
  }
}

const app = read("packages/web/src/app.ts");
for (const route of [
  "/auth/auth-code-error",
  "/settings/auth-status",
  "/app/admin/auth-status",
  "/app/admin/setup",
  "/app/admin/launch-readiness"
]) {
  if (!app.includes(`"${route}"`)) {
    issues.push(`App route registry missing ${route}.`);
  }
}

const oauth = read("packages/web/src/components/auth/OAuthButtons.tsx");
if (!oauth.includes("createGoogleOAuthAction")) {
  issues.push("OAuthButtons must use createGoogleOAuthAction.");
}
if (!oauth.includes("disabled")) {
  issues.push("OAuthButtons must disable Google when provider setup is not ready.");
}

const authActions = read("packages/web/src/lib/auth/auth-actions.ts");
const publicEnv = read("packages/web/src/lib/public-env.ts");
for (const expected of [
  "getAuthCallbackUrl",
  "publicEnv.googleEnabled",
  "Google sign-in is not enabled yet. Use email/password or email link, or finish Supabase Google provider setup."
]) {
  if (!authActions.includes(expected)) {
    issues.push(`auth-actions missing expected auth guard: ${expected}`);
  }
}
if (!publicEnv.includes("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED")) {
  issues.push("public-env must read NEXT_PUBLIC_AUTH_GOOGLE_ENABLED.");
}

const authErrors = read("packages/web/src/lib/auth/auth-error-messages.ts");
for (const code of [
  "provider_not_enabled",
  "validation_failed",
  "invalid_redirect",
  "missing_env",
  "exchange_failed",
  "unknown_error"
]) {
  if (!authErrors.includes(code)) {
    issues.push(`Auth error page missing code: ${code}`);
  }
}

const envExample = exists(".env.example") ? read(".env.example") : "";
for (const flag of [
  "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false",
  "NEXT_PUBLIC_AUTH_PHONE_ENABLED=false"
]) {
  if (!envExample.includes(flag)) {
    issues.push(`.env.example missing ${flag}.`);
  }
}

for (const filePath of listFiles(["packages/web/src"])) {
  const rel = relative(filePath);
  if (!/\.(ts|tsx)$/.test(rel)) continue;
  if (rel.includes("/lib/") && !rel.includes("/lib/auth/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  if (
    /SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|DATABASE_URL/.test(source) &&
    /\.tsx$/.test(rel)
  ) {
    issues.push(`${rel} references server-only env names in client-rendered auth code.`);
  }
}

failIfIssues("Auth configuration check", issues);
