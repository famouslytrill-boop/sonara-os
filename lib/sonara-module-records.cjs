"use strict";

// How a saved module result becomes a row, and which table it belongs in.
//
// Two things happen when somebody saves work in a workspace. The raw result is
// written to module_outputs, which every product shares; and, for the three
// cases that have a real home, a typed row is written to the table that owns it
// -- creator_assets, growth_campaigns, growth_leads. buildDomainModuleRecord is
// the mapping, and returning null is how it says "this one only has a generic
// output", which is the common case rather than an error.
//
// saveModuleOutput and readModuleRecords, which call into here, stayed in
// server.js: apply-business-builder-operating-system.cjs and
// apply-customer-ready-production-experience.cjs each contain a full definition
// of one, so moving them would leave two definitions of the same function the
// next time apply:runtime runs. That is not hypothetical -- it is what
// apply-catalog-helper-scope.cjs did to catalogActions, and the file still
// parsed and the tests still passed while the later definition silently won.
//
// safeInsertBusinessBuilderOperatingRecord stayed for the same reason.

const REQUIRED = ["getSupabaseAdminClient", "supabaseHeaders"];

function createModuleRecords(deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`createModuleRecords requires ${name}`);
  }
  const { getSupabaseAdminClient, supabaseHeaders } = deps;

  async function safeInsertModuleOutput(organizationId, productKey, moduleKey, input, output) {
    const config = getSupabaseAdminClient();
    if (!config.ok) return { ok: false, code: "setup_required" };
    if (!organizationId) return { ok: false, code: "organization_setup_required" };
    const response = await fetch(`${config.url}/rest/v1/module_outputs`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify({ organization_id: organizationId, product_key: productKey, module_key: moduleKey, input_payload: input, output_payload: output })
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok), rows: response?.ok ? await response.json().catch(() => []) : [] };
  }

  async function safeInsertDomainModuleRecord(organizationId, userId, productKey, moduleKey, input, output) {
    const config = getSupabaseAdminClient();
    if (!config.ok || !organizationId) return { ok: false, code: "setup_required" };
    const domain = buildDomainModuleRecord(organizationId, userId, productKey, moduleKey, input, output);
    if (!domain) return { ok: false, code: "not_applicable" };
    const response = await fetch(`${config.url}/rest/v1/${domain.table}`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(domain.record)
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok), table: domain.table, rows: response?.ok ? await response.json().catch(() => []) : [] };
  }

  function buildDomainModuleRecord(organizationId, userId, productKey, moduleKey, input, output) {
    if (productKey === "creator_studio" && moduleKey === "asset_catalog") {
      const assetType = normalizeAssetType(input.type || input.assetType);
      return {
        table: "creator_assets",
        record: {
          organization_id: organizationId,
          user_id: userId || null,
          title: String(input.title || "Untitled asset").trim(),
          asset_type: assetType,
          status: normalizeCreatorAssetStatus(input.status),
          metadata: {
            platform: String(input.platform || "").trim() || null,
            rights_notes: String(input.rightsNotes || input.rights_notes || "").trim() || null,
            source: "creator_studio_asset_form",
            output
          }
        }
      };
    }
    if (productKey === "growth_studio" && moduleKey === "campaign_workspace") {
      return {
        table: "growth_campaigns",
        record: {
          organization_id: organizationId,
          user_id: userId || null,
          name: String(input.goal || "Growth campaign").trim(),
          goal: String(input.goal || "").trim() || null,
          channel: String(input.channel || "").trim() || null,
          status: "draft",
          metadata: {
            audience: String(input.audience || "").trim() || null,
            offer: String(input.offer || "").trim() || null,
            timeline: String(input.timeline || "").trim() || null,
            source: "growth_studio_campaign_form",
            output
          }
        }
      };
    }
    if (productKey === "growth_studio" && moduleKey === "lead_follow_up") {
      return {
        table: "growth_leads",
        record: {
          organization_id: organizationId,
          user_id: userId || null,
          name: String(input.name || "").trim() || null,
          email: String(input.email || "").trim() || null,
          source: String(input.source || "").trim() || null,
          status: "new",
          metadata: {
            consent_status: String(input.consentStatus || input.consent_status || "").trim() || null,
            compliance_warning: "Phone, SMS, and voicemail outreach may be regulated. Confirm valid consent and honor opt-outs before contacting anyone.",
            source: "growth_studio_lead_form",
            output
          }
        }
      };
    }
    return null;
  }

  async function safeReadOrganizationScopedRecords(organizationId, productKey) {
    const config = getSupabaseAdminClient();
    if (!config.ok) return { ok: false, code: "setup_required", records: [], shared: {} };
    if (!organizationId) return { ok: false, code: "organization_setup_required", records: [], shared: {} };
    const response = await fetch(`${config.url}/rest/v1/module_outputs?select=id,module_key,created_at,output_payload&organization_id=eq.${encodeURIComponent(organizationId)}&product_key=eq.${encodeURIComponent(productKey)}&order=created_at.desc&limit=20`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, code: "read_failed", records: [], shared: {} };
    const records = await response.json().catch(() => []);

    // Which of these the customer has published, from shared_links -- the one
    // table that answers that for every shareable kind since migration
    // 20260819070000. A second read rather than a join, because PostgREST can
    // only embed across a declared foreign key and shared_links deliberately has
    // none: resource_id points at whichever table resource_type names.
    //
    // A failed link read is NOT an unshared result. It returns null, and the
    // page says it could not tell rather than showing a Share button for
    // something that is already public.
    const shared = await readLiveShareLinks(config, organizationId, records.map((row) => row.id));
    return { ok: true, records, shared };
  }

  async function readLiveShareLinks(config, organizationId, resourceIds) {
    const ids = (resourceIds || []).filter(Boolean);
    if (!ids.length) return {};
    const list = ids.map((id) => `"${id}"`).join(",");
    const response = await fetch(
      `${config.url}/rest/v1/shared_links?select=resource_id,token,shared_at&organization_id=eq.${encodeURIComponent(organizationId)}`
        + `&resource_type=eq.module_output&revoked_at=is.null&resource_id=in.(${encodeURIComponent(list)})`,
      { headers: supabaseHeaders(config) }
    ).catch(() => undefined);
    if (!response?.ok) return null;
    const rows = await response.json().catch(() => undefined);
    if (!Array.isArray(rows)) return null;
    return Object.fromEntries(rows.map((row) => [String(row.resource_id), { token: row.token, sharedAt: row.shared_at }]));
  }

  function normalizeAssetType(value) {
    const normalized = String(value || "file").trim().toLowerCase().replace(/\s+/g, "_");
    return ["image", "video", "audio", "document", "link", "file", "other"].includes(normalized) ? normalized : "other";
  }

  function normalizeCreatorAssetStatus(value) {
    const normalized = String(value || "draft").trim().toLowerCase().replace(/\s+/g, "_");
    return ["draft", "ready", "published", "archived"].includes(normalized) ? normalized : "draft";
  }

  return {
    buildDomainModuleRecord,
    normalizeAssetType,
    normalizeCreatorAssetStatus,
    safeInsertDomainModuleRecord,
    safeInsertModuleOutput,
    safeReadOrganizationScopedRecords,
    readLiveShareLinks
  };
}

module.exports = { createModuleRecords, REQUIRED };
