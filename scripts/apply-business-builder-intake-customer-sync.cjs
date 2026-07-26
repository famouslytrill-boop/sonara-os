"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");

const helperName = "async function safeInsertBusinessBuilderCustomerFromIntake";
const intakeMarker = "async function saveBusinessBuilderIntake(req, output) {";

if (!source.includes(helperName)) {
  if (!source.includes(intakeMarker)) throw new Error("Business Builder intake marker not found");

  const helper = `async function safeInsertBusinessBuilderCustomerFromIntake(organizationId, userId, intakeRecord) {
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false, code: "setup_required", rows: [] };

  const businessResponse = await fetch(\`${'${config.url}'}/rest/v1/business_workspaces?select=id&organization_id=eq.\${encodeURIComponent(organizationId)}&deleted_at=is.null&order=created_at.asc&limit=1\`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!businessResponse?.ok) return { ok: false, code: "business_lookup_failed", rows: [] };

  const businesses = await businessResponse.json().catch(() => []);
  const businessId = businesses[0]?.id;
  if (!businessId) return { ok: false, code: "business_required", rows: [] };

  const response = await fetch(\`${'${config.url}'}/rest/v1/customer_records\`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      organization_id: organizationId,
      business_id: businessId,
      user_id: userId || null,
      name: String(intakeRecord.contact_name || intakeRecord.company_name || "New lead").trim(),
      email: intakeRecord.email || null,
      phone: intakeRecord.phone || null,
      status: "lead",
      notes: intakeRecord.goals || null,
      metadata: {
        company_name: intakeRecord.company_name || null,
        industry: intakeRecord.industry || null,
        budget: intakeRecord.budget || null,
        timeline: intakeRecord.timeline || null,
        current_website: intakeRecord.current_website || null,
        needed_services: Array.isArray(intakeRecord.needed_services) ? intakeRecord.needed_services : [],
        source: "business_builder_intake"
      }
    })
  }).catch(() => undefined);

  return {
    ok: Boolean(response?.ok),
    code: response?.ok ? "saved" : "save_failed",
    businessId,
    rows: response?.ok ? await response.json().catch(() => []) : []
  };
}

`;

  source = source.replace(intakeMarker, `${helper}${intakeMarker}`);
}

const rowsLine = "  const rows = await intake.json().catch(() => []);";
const syncedRows = `${rowsLine}
  const customerRecord = await safeInsertBusinessBuilderCustomerFromIntake(
    organization.organizationId,
    req.sonaraUser?.id,
    record
  );`;
if (!source.includes("const customerRecord = await safeInsertBusinessBuilderCustomerFromIntake")) {
  if (!source.includes(rowsLine)) throw new Error("Business Builder intake rows marker not found");
  source = source.replace(rowsLine, syncedRows);
}

const oldReturn = '  return { ok: true, saved: true, code: "saved", emailDelivery: email.ok ? "sent" : "setup_required", intakeRequestId: rows[0]?.id, output };';
const newReturn = `  return {
    ok: true,
    saved: true,
    code: "saved",
    emailDelivery: email.ok ? "sent" : "setup_required",
    intakeRequestId: rows[0]?.id,
    customerRecordSaved: customerRecord.ok,
    customerRecordId: customerRecord.rows?.[0]?.id || null,
    businessId: customerRecord.businessId || null,
    output
  };`;
if (!source.includes("customerRecordSaved: customerRecord.ok")) {
  if (!source.includes(oldReturn)) throw new Error("Business Builder intake return marker not found");
  source = source.replace(oldReturn, newReturn);
}

fs.writeFileSync(file, source);
console.log("Business Builder intake now syncs to customer leads");
