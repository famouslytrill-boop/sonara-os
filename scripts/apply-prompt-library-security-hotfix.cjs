"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchPromptRoutes();
patchSupabaseVerifier();

console.log("Prompt Library production security boundaries applied");

function patchPromptRoutes() {
  const filePath = path.join(__dirname, "..", "routes", "sonara-prompt-library-routes.cjs");
  let source = fs.readFileSync(filePath, "utf8");

  source = replaceOnce(source,
    '    const query = `?organization_id=eq.${context.organizationId}&product_area=eq.${req.promptProductArea}&select=*&order=updated_at.desc&limit=100`;',
    `    const visibility = promptVisibilityQuery(req.sonaraUser?.id, true);
    if (!visibility.ok) return res.status(401).json(visibility);
    const query = \`?organization_id=eq.\${context.organizationId}&product_area=eq.\${req.promptProductArea}&\${visibility.query}&select=*&order=updated_at.desc&limit=100\`;`
  );

  source = replaceOnce(source,
    '    const query = `?organization_id=eq.${context.organizationId}&product_area=eq.${req.promptProductArea}&select=*,sonara_prompt_collection_items(*)&order=updated_at.desc&limit=100`;',
    `    const visibility = promptVisibilityQuery(req.sonaraUser?.id, false);
    if (!visibility.ok) return res.status(401).json(visibility);
    const query = \`?organization_id=eq.\${context.organizationId}&product_area=eq.\${req.promptProductArea}&\${visibility.query}&select=*,sonara_prompt_collection_items(*)&order=updated_at.desc&limit=100\`;`
  );

  source = source.replace(
    /getOwnedRecord\(context, "sonara_prompt_templates", req\.params\.id\)/g,
    'getOwnedRecord(context, "sonara_prompt_templates", req.params.id, req.sonaraUser?.id)'
  );
  source = source.replace(
    /getOwnedRecord\(context, "sonara_prompt_templates", templateId\)/g,
    'getOwnedRecord(context, "sonara_prompt_templates", templateId, req.sonaraUser?.id)'
  );
  source = source.replace(
    /getOwnedRecord\(context, "sonara_prompt_collections", req\.params\.id\)/g,
    'getOwnedRecord(context, "sonara_prompt_collections", req.params.id, req.sonaraUser?.id)'
  );
  source = source.replace(
    /getOwnedRecord\(context, "sonara_prompt_templates", validation\.record\.sourceId\)/g,
    'getOwnedRecord(context, "sonara_prompt_templates", validation.record.sourceId, req.sonaraUser?.id)'
  );
  source = source.replace(
    /getOwnedRecord\(context, "sonara_prompt_templates", validation\.record\.targetId\)/g,
    'getOwnedRecord(context, "sonara_prompt_templates", validation.record.targetId, req.sonaraUser?.id)'
  );

  source = source.replace(
    /return res\.status\(existing\.code === "not_found" \? 404 : 503\)\.json\(existing\);/g,
    'return res.status(ownedRecordStatus(existing)).json(existing);'
  );
  source = source.replace(
    /return res\.status\(owned\.code === "not_found" \? 404 : 503\)\.json\(owned\);/g,
    'return res.status(ownedRecordStatus(owned)).json(owned);'
  );

  source = replaceOnce(source,
    '      inputSchema: existing.row.input_schema,',
    '      inputSchema: {},'
  );

  source = replaceOnce(source,
    `    if (!collection.ok || !prompt.ok) return res.status(404).json({ ok: false, code: "collection_or_template_not_found" });`,
    `    if (!collection.ok) return res.status(ownedRecordStatus(collection)).json(collection);
    if (!prompt.ok) return res.status(ownedRecordStatus(prompt)).json(prompt);`
  );

  source = replaceOnce(source,
    `    if (!source.ok || !target.ok) return res.status(404).json({ ok: false, code: "template_not_found" });`,
    `    if (!source.ok) return res.status(ownedRecordStatus(source)).json(source);
    if (!target.ok) return res.status(ownedRecordStatus(target)).json(target);`
  );

  const ownedRecordBefore = `async function getOwnedRecord(context, table, id) {
  const query = \`?id=eq.\${encodeURIComponent(id)}&organization_id=eq.\${context.organizationId}&select=*&limit=1\`;
  const result = await restRequest(context, table, query);
  if (!result.ok) return result;
  if (!result.rows.length) return { ok: false, code: "not_found", table };
  return { ok: true, row: result.rows[0] };
}`;
  const ownedRecordAfter = `async function getOwnedRecord(context, table, id, userId) {
  const query = \`?id=eq.\${encodeURIComponent(id)}&organization_id=eq.\${context.organizationId}&select=*&limit=1\`;
  const result = await restRequest(context, table, query);
  if (!result.ok) return result;
  if (!result.rows.length) return { ok: false, code: "not_found", table };
  const row = result.rows[0];
  if (!canReadVisibilityScopedRecord(row, userId)) return { ok: false, code: "forbidden", table };
  return { ok: true, row };
}

function promptVisibilityQuery(userId, includePublic) {
  if (!isUuid(userId)) return { ok: false, code: "account_identity_required" };
  const creator = encodeURIComponent(userId);
  const shared = includePublic
    ? "visibility.eq.organization,and(visibility.eq.public,status.eq.published)"
    : "visibility.eq.organization";
  return {
    ok: true,
    query: \`or=(\${shared},and(visibility.eq.private,created_by.eq.\${creator}))\`
  };
}

function canReadVisibilityScopedRecord(row, userId) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, "visibility")) return true;
  if (row.visibility === "private") return Boolean(userId && row.created_by === userId);
  if (row.visibility === "public" && row.status && row.status !== "published") {
    return Boolean(userId && row.created_by === userId);
  }
  return true;
}

function ownedRecordStatus(result) {
  if (result?.code === "not_found") return 404;
  if (result?.code === "forbidden") return 403;
  return 503;
}`;
  source = replaceOnce(source, ownedRecordBefore, ownedRecordAfter);

  const sensitiveBefore = `function detectSensitivePayload(value) {
  const text = JSON.stringify(value || {});
  const findings = [];
  const checks = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "private_key"],
    [/\\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\\b/, "provider_secret_key"],
    [/\\bgh[pousr]_[A-Za-z0-9]{20,}\\b/, "github_token"],
    [/\\bsb_secret_[A-Za-z0-9_-]{12,}\\b/, "supabase_secret"],
    [/\\b(?:password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\\s*[:=]\\s*\\S+/i, "credential_like_value"]
  ];
  for (const [pattern, name] of checks) if (pattern.test(text)) findings.push(name);
  return findings;
}`;
  const sensitiveAfter = `function detectSensitivePayload(value) {
  const text = JSON.stringify(value || {});
  const findings = [];
  const checks = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "private_key"],
    [/\\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\\b/, "provider_secret_key"],
    [/\\bgh[pousr]_[A-Za-z0-9]{20,}\\b/, "github_token"],
    [/\\bsb_secret_[A-Za-z0-9_-]{12,}\\b/, "supabase_secret"],
    [/\\b(?:password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\\s*[:=]\\s*\\S+/i, "credential_like_value"],
    [/\\b(?:cvv|cvc|card security code|security code)\\b\\s*[:=]?\\s*[0-9]{3,4}\\b/i, "payment_card_security_code"],
    [/(?:%B|;)\\d{13,19}(?:\\^|=)/i, "payment_card_track_data"]
  ];
  for (const [pattern, name] of checks) if (pattern.test(text)) findings.push(name);

  const cardCandidates = text.match(/(?:\\d[ -]?){13,19}/g) || [];
  for (const candidate of cardCandidates) {
    const digits = candidate.replace(/\\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      findings.push("payment_card_number");
      break;
    }
  }

  if (/\\b(?:card(?: number)?|pan)\\b\\s*[:=]?\\s*(?:\\d[ -]?){13,19}/i.test(text)) {
    findings.push("payment_card_number");
  }

  return [...new Set(findings)];
}

function luhnValid(digits) {
  if (!/^[0-9]{13,19}$/.test(String(digits || ""))) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}`;
  source = replaceOnce(source, sensitiveBefore, sensitiveAfter);

  fs.writeFileSync(filePath, source);
}

function patchSupabaseVerifier() {
  const filePath = path.join(__dirname, "..", "scripts", "verify-supabase-contract.mjs");
  let source = fs.readFileSync(filePath, "utf8");

  if (!source.includes('const promptLibrarySecurityMigrationName = "20260726194500_prompt_library_production_boundaries.sql";')) {
    source = replaceOnce(source,
      'const promptLibraryMigrationName = "20260726163000_sonara_prompt_library.sql";',
      'const promptLibraryMigrationName = "20260726163000_sonara_prompt_library.sql";\nconst promptLibrarySecurityMigrationName = "20260726194500_prompt_library_production_boundaries.sql";'
    );
  }

  if (!source.includes("const promptLibrarySecurityMigrationPath = path.join(migrationsDirectory, promptLibrarySecurityMigrationName);")) {
    source = replaceOnce(source,
      'const promptLibraryMigrationPath = path.join(migrationsDirectory, promptLibraryMigrationName);',
      'const promptLibraryMigrationPath = path.join(migrationsDirectory, promptLibraryMigrationName);\nconst promptLibrarySecurityMigrationPath = path.join(migrationsDirectory, promptLibrarySecurityMigrationName);'
    );
  }

  source = ensureConstArrayValue(source, "contractSql", "promptLibrarySecurityMigrationPath");

  const promptLibrarySqlBase = 'const promptLibrarySql = read(promptLibraryMigrationPath).toLowerCase();';
  const promptLibrarySqlSecurity = 'const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\\n").toLowerCase();';
  const promptLibrarySqlNormalized = 'const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\\n").toLowerCase().replace(/\\s+/g, " ").trim();';
  if (!source.includes(promptLibrarySqlSecurity) && !source.includes(promptLibrarySqlNormalized)) {
    source = replaceOnce(source, promptLibrarySqlBase, promptLibrarySqlSecurity);
  }

  source = source.replace(
    '"revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text) from public, anon",\n  "grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text) to authenticated, service_role"',
    '"revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text) from public, anon, authenticated",\n  "grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text) to service_role",\n  "grant select, insert, update, delete on table public.%i to service_role",\n  "input_schema = v_input_schema",\n  "members read visible prompt templates",\n  "members read visible prompt collections"'
  );

  fs.writeFileSync(filePath, source);
}

function ensureConstArrayValue(source, constantName, value) {
  const pattern = new RegExp(`(const\\s+${escapeRegExp(constantName)}\\s*=\\s*\\[)([^\\]]*)(\\])`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Prompt Library security ${constantName} array not found`);
  const items = match[2].split(",").map((item) => item.trim()).filter(Boolean);
  if (items.includes(value)) return source;
  items.push(value);
  return source.replace(pattern, (_, opening, _body, closing) => `${opening}${items.join(", ")}${closing}`);
}

function replaceOnce(source, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Prompt Library security hotfix marker not found: ${before.slice(0, 100)}`);
  return source.replace(before, after);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
