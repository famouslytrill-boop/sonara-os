// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { verifyProposalSql, verifyFiles } = require("../scripts/verify-social-sql-proposals.cjs");

const channel = fs.readFileSync(path.join(__dirname, "..", "docs", "sql-proposals",
  "2026-10-09-growth-channel-blocking-moderation.sql"), "utf8");

describe("proposed social database migration preflight", () => {
  it("passes every current review-only social SQL proposal", () => {
    const reports = verifyFiles(path.join(__dirname, ".."));
    assert.ok(reports.length >= 1);
    for (const report of reports) assert.deepEqual(report.issues, [], report.filename);
  });

  it("rejects a single-dollar PL/pgSQL opener and closer", () => {
    // The specific regression encountered in the October 9 block-limit RPC.
    const malformed = channel.replace("as $$\nbegin", "as $\nbegin");
    const result = verifyProposalSql("malformed.sql", malformed);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((e) => e.includes("invalid_dollar_quote_opening")));
  });

  it("rejects unterminated functions and semicolon loss", () => {
    const missingClose = channel.replace("end;\n$$;\nrevoke all on function public.sonara_growth_channel_block_action",
      "end;\nrevoke all on function public.sonara_growth_channel_block_action");
    assert.ok(verifyProposalSql("missing-close.sql", missingClose).issues.some(
      (e) => e.includes("unterminated_dollar_quote")));
    const missingTerminator = channel.replace("end;\n$$;\nrevoke all on function public.sonara_growth_channel_block_action",
      () => "end;\n$$\nrevoke all on function public.sonara_growth_channel_block_action");
    assert.ok(verifyProposalSql("missing-terminator.sql", missingTerminator).issues.some(
      (e) => e.includes("missing_function_semicolon")));
  });

  it("requires table RLS, revoke, RPC grants, and invoker security", () => {
    const withoutRls = channel.replace("alter table public.growth_channel_blocks enable row level security;", "");
    assert.ok(verifyProposalSql("no-rls.sql", withoutRls).issues.some(e => e.includes("missing_rls")));
    const withoutRevoke = channel.replace("revoke all on public.growth_channel_blocks from public, anon, authenticated;", "");
    assert.ok(verifyProposalSql("no-revoke.sql", withoutRevoke).issues.some(e => e.includes("missing_client_revoke")));
    const withDefiner = channel.replace("returns text language plpgsql security invoker",
      "returns text language plpgsql security definer");
    assert.ok(verifyProposalSql("definer.sql", withDefiner).issues.some(e => e.includes("unexpected_security_definer")));
  });

  it("does not claim to parse PostgreSQL or verify migrations", () => {
    const output = verifyProposalSql("review-only.sql", channel);
    assert.ok(output.ok);
    assert.equal(output.functions.length, 2);
    assert.equal(output.tables.length, 2);
  });
});
