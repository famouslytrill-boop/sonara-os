import { exists, failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const missingUserMessage =
  "Create/login with this email first using Supabase Auth, then rerun owner bootstrap.";

const requiredFiles = [
  "docs/admin/OWNER_ADMIN_BOOTSTRAP.md",
  "docs/admin/FIRST_OWNER_SETUP.md",
  "docs/admin/SUPABASE_AUTH_USER_REQUIRED.md",
  "supabase/bootstrap/ensure_owner_membership.sql",
  "supabase/bootstrap/check_auth_user_exists.sql",
  "supabase/bootstrap/check_organization_schema.sql",
  "scripts/generate-owner-bootstrap-sql.mjs"
];

for (const filePath of requiredFiles) {
  if (!exists(filePath)) {
    issues.push(`Missing owner bootstrap artifact: ${filePath}`);
  }
}

for (const filePath of requiredFiles.filter(
  (filePath) => exists(filePath) && !filePath.endsWith("check_organization_schema.sql")
)) {
  const source = read(filePath);
  if (!source.includes(missingUserMessage)) {
    issues.push(`${filePath} missing required missing-auth-user message.`);
  }
  if (/disable\s+row\s+level\s+security/i.test(source)) {
    issues.push(`${filePath} must not disable RLS.`);
  }
}

const bootstrapSql = exists("supabase/bootstrap/ensure_owner_membership.sql")
  ? read("supabase/bootstrap/ensure_owner_membership.sql")
  : "";
for (const expected of [
  "auth.users",
  "information_schema.columns",
  "organization_members",
  "organization_memberships",
  "company_key",
  "where not exists"
]) {
  if (!bootstrapSql.toLowerCase().includes(expected.toLowerCase())) {
    issues.push(`Owner bootstrap SQL missing compatibility term: ${expected}`);
  }
}

if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(bootstrapSql.replaceAll("<OWNER_EMAIL>", ""))) {
  issues.push("Owner bootstrap SQL must not include a real committed owner email.");
}

failIfIssues("Admin bootstrap check", issues);
