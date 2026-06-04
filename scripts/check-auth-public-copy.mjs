import {
  failIfIssues,
  isAllowedSafetyContext,
  linesWith,
  listFiles,
  relative
} from "./check-utils.mjs";

const issues = [];
const files = listFiles(["packages/web/src/app", "packages/web/src/components/auth"]).filter(
  (filePath) =>
    /auth|login|signup|forgot-password|reset-password|settings[\\/]security/i.test(filePath)
);

const forbidden = [
  /user not found/i,
  /email already/i,
  /already registered/i,
  /account does not exist/i,
  /service[_ -]?role/i,
  /stack trace/i,
  /database error/i
];

for (const filePath of files) {
  for (const pattern of forbidden) {
    for (const hit of linesWith(filePath, pattern)) {
      if (!isAllowedSafetyContext(hit.line)) {
        issues.push(`${relative(filePath)}:${hit.lineNumber} exposes unsafe auth copy.`);
      }
    }
  }
}

failIfIssues("Auth public copy check", issues);
