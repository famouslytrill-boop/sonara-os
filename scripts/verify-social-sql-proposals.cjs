// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Fast, deterministic LEXICAL checks for review-only SQL proposals.
// This is not a PostgreSQL parser and cannot replace a real migration replay.
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_SERVICE_ROLE_GRANTS = Object.freeze({
  growth_channel_blocks: "select,insert,delete",
  growth_channel_moderation_events: "select,insert",
  sonara_social_user_blocks: "select,insert,delete",
  sonara_social_profile_reports: "select,insert,update",
  sonara_social_moderator_grants: "select",
  sonara_social_report_review_events: "select,insert"
});

const PROPOSALS = Object.freeze([
  "2026-10-09-growth-channel-blocking-moderation.sql",
  "2026-10-09-social-user-blocks-and-reports.sql"
]);

function withoutLineComments(source) {
  return String(source || "").replace(/^[ \t]*--[^\n]*$/gm, "");
}
function verifyProposalSql(filename, sql) {
  const issues = [];
  const stripped = withoutLineComments(sql);
  if (!/\bNOT\s+(?:A\s+DEPLOYABLE\s+MIGRATION|APPLIED)\b/i.test(String(sql))) {
    issues.push("missing_unapplied_proposal_marker");
  }
  const functions = [...stripped.matchAll(/^\s*create\s+(?:or\s+replace\s+)?function\s+public\.([a-z][a-z0-9_]*)\s*\(/gim)];
  if (!functions.length) issues.push("no_functions_found");
  const foundFunctions = new Set();
  for (let i = 0; i < functions.length; i += 1) {
    const declaration = functions[i], name = declaration[1];
    if (foundFunctions.has(name)) issues.push(name + ":duplicate_definition");
    foundFunctions.add(name);
    const block = stripped.slice(declaration.index, functions[i+1]?.index ?? stripped.length);
    const opener = /\bas\s+(\$[a-zA-Z0-9_]*\$)/i.exec(block);
    if (!opener) {
      issues.push(name + ":invalid_dollar_quote_opening");
      continue;
    }
    const token = opener[1];
    const bodyStart = opener.index + opener[0].length;
    const closer = block.indexOf(token, bodyStart);
    if (closer < 0) {
      issues.push(name + ":unterminated_dollar_quote");
      continue;
    }
    if (!/^\s*;/.test(block.slice(closer + token.length))) {
      issues.push(name + ":missing_function_semicolon");
    }
    const body = block.slice(bodyStart, closer);
    if (!/\b(?:select|insert|delete|update|perform|return|begin)\b/i.test(body)) {
      issues.push(name + ":empty_or_suspicious_body");
    }
    if (/\bsecurity\s+definer\b/i.test(block.slice(0,closer))) {
      issues.push(name + ":unexpected_security_definer");
    }
    const grant = new RegExp("grant\\s+execute\\s+on\\s+function\\s+public\\." + name + "\\s*\\(", "i");
    const revoked = new RegExp("revoke\\s+all\\s+on\\s+function\\s+public\\." + name + "\\s*\\(", "i");
    if (!grant.test(stripped)) issues.push(name + ":missing_service_role_execute_grant");
    if (!revoked.test(stripped)) issues.push(name + ":missing_client_execute_revoke");
  }
  const tables = [...stripped.matchAll(/^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z][a-z0-9_]*)\s*\(/gim)].map(m => m[1]);
  if (!tables.length) issues.push("no_tables_found");
  for (const name of tables) {
    const rls = new RegExp("alter\\s+table\\s+public\\." + name + "\\s+enable\\s+row\\s+level\\s+security", "i");
    const revoke = new RegExp("revoke\\s+all\\s+on\\s+public\\." + name + "\\s+from\\s+(?:public|PUBLIC),\\s*anon,\\s*authenticated", "i");
    if (!rls.test(stripped)) issues.push(name + ":missing_rls");
    if (!revoke.test(stripped)) issues.push(name + ":missing_client_revoke");
    const privilegeReset = new RegExp(
      "revoke\\s+all\\s+on\\s+public\\." + name +
      "\\s+from\\s+(?:public),\\s*anon,\\s*authenticated,\\s*service_role", "i");
    if (!privilegeReset.test(stripped)) issues.push(name + ":missing_service_role_default_revoke");
    const expected = EXPECTED_SERVICE_ROLE_GRANTS[name];
    if (expected) {
      const grantMatch = new RegExp("grant\\s+([a-z,\\s]+)\\s+on\\s+public\\." +
        name + "\\s+to\\s+service_role\\s*;", "i").exec(stripped);
      const actual = grantMatch ? grantMatch[1].toLowerCase().replace(/\s+/g, "").split(",").sort().join(",") : "";
      const allowed = expected.split(",").sort().join(",");
      if (actual !== allowed) issues.push(name + ":unexpected_service_role_privileges");
    }
  }
  return Object.freeze({ filename, functions: [...foundFunctions], tables, issues, ok: issues.length === 0 });
}

function verifyFiles(root) {
  const dir = path.join(root, "docs", "sql-proposals");
  const reports = PROPOSALS.filter(name => fs.existsSync(path.join(dir, name))).map(name =>
    verifyProposalSql(name, fs.readFileSync(path.join(dir, name), "utf8")));
  if (!reports.length) throw new Error("social SQL proposals were not found");
  return reports;
}

if (require.main === module) {
  const reports = verifyFiles(process.cwd());
  for (const r of reports) {
    console.log(r.filename + ": " + (r.ok ? "PASS" : "FAIL") +
      " (" + r.functions.length + " functions; " + r.tables.length + " tables)" +
      (r.issues.length ? "\n  " + r.issues.join("\n  ") : ""));
  }
  if (reports.some(r => !r.ok)) process.exitCode = 1;
}

module.exports = { verifyProposalSql, verifyFiles, PROPOSALS };
