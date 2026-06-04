import { exists, failIfIssues, read } from "./check-utils.mjs";

const requiredFiles = [
  "packages/web/src/app/login/page.ts",
  "packages/web/src/app/signup/page.ts",
  "packages/web/src/app/auth/callback/page.ts",
  "packages/web/src/app/forgot-password/page.ts",
  "packages/web/src/app/reset-password/page.ts",
  "packages/web/src/app/settings/security/page.ts",
  "packages/web/src/app/admin/owner-bootstrap/page.ts",
  "packages/web/src/components/auth/AuthShell.tsx",
  "packages/web/src/components/auth/LoginForm.tsx",
  "packages/web/src/components/auth/SignupForm.tsx",
  "packages/web/src/components/auth/OAuthButtons.tsx",
  "packages/web/src/components/auth/MagicLinkForm.tsx",
  "packages/web/src/components/auth/PasswordField.tsx",
  "packages/web/src/components/auth/AuthErrorNotice.tsx",
  "packages/web/src/components/auth/AuthReadinessCard.tsx",
  "packages/web/src/components/auth/OwnerBootstrapNotice.tsx",
  "packages/web/src/lib/auth/auth-readiness.ts",
  "packages/web/src/lib/auth/auth-errors.ts",
  "packages/web/src/lib/auth/auth-redirects.ts",
  "packages/web/src/lib/auth/password-policy.ts",
  "packages/web/src/lib/auth/oauth-provider-registry.ts",
  "packages/web/src/lib/auth/org-membership.ts",
  "packages/web/src/lib/auth/admin-guard.ts",
  "packages/web/src/lib/auth/owner-bootstrap-policy.ts"
];

const issues = requiredFiles
  .filter((filePath) => !exists(filePath))
  .map((filePath) => `Missing auth readiness file: ${filePath}`);

const routeManifest = read("packages/web/src/routes/route-manifest.ts");
for (const route of [
  "/login",
  "/signup",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/app/settings/security",
  "/app/admin/owner-bootstrap"
]) {
  if (!routeManifest.includes(`route: "${route}"`)) {
    issues.push(`Route manifest missing auth route: ${route}`);
  }
}

const loginPage = read("packages/web/src/app/login/page.ts");
const signupPage = read("packages/web/src/app/signup/page.ts");
for (const expected of [
  "renderOAuthButtons",
  "renderMagicLinkForm",
  "renderAuthReadinessCard",
  "createSupabaseAuthConfigDiagnostic"
]) {
  if (!loginPage.includes(expected) || !signupPage.includes(expected)) {
    issues.push(`Login/signup pages must use ${expected}.`);
  }
}

const passwordField = read("packages/web/src/components/auth/PasswordField.tsx");
if (!passwordField.includes("Show") || !passwordField.includes("Hide")) {
  issues.push("PasswordField must implement show/hide password controls.");
}

failIfIssues("Auth readiness check", issues);
