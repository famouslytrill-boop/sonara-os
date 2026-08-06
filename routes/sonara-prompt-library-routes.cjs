"use strict";

const {
  BUILTIN_PROMPT_TEMPLATES,
  PRODUCT_LABELS,
  getPromptLibrarySummary,
  getPromptTemplate,
  listPromptTemplates,
  normalizeProductArea,
  renderPrompt,
  reviewImportBatch,
  validateConnection,
  validatePromptRecord
} = require("../lib/sonara-prompt-library.cjs");
const { PROMPT_LIBRARY_TABLES } = require("../data/prompts-chat-reference.cjs");
const { escapeHtml } = require("../lib/sonara-shell.cjs");

const LIVE_PROBE_TIMEOUT_MS = 900;

module.exports = function registerSonaraPromptLibraryRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const safeListTable = typeof deps.safeListTable === "function" ? deps.safeListTable : undefined;
  const getSupabaseServerConfig = typeof deps.getSupabaseServerConfig === "function" ? deps.getSupabaseServerConfig : undefined;
  const getCustomerPrimaryOrganization = typeof deps.getCustomerPrimaryOrganization === "function" ? deps.getCustomerPrimaryOrganization : undefined;
  const supabaseHeaders = typeof deps.supabaseHeaders === "function" ? deps.supabaseHeaders : undefined;
  const insertActivityEvent = typeof deps.insertActivityEvent === "function" ? deps.insertActivityEvent : async () => ({ ok: false });
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function" ? deps.recordAdminAuditEvent : async () => undefined;

  app.get("/prompt-library", (req, res) => {
    const productArea = normalizeProductArea(req.query.product);
    const templates = listPromptTemplates({ productArea, category: req.query.category, query: req.query.q });
    return res.status(200).type("html").send(layout({
      // Public and browsable without an account -- it is one of the things a
      // prospective customer looks at before signing up. The per-product
      // prompt pages behind sign-in stay work surfaces.
      surface: "marketing",
      title: "Prompt Library",
      eyebrow: "SONARA Prompt Library",
      heading: "Reusable instructions for real work",
      body: "Browse original, provider-neutral instruction templates. Previewing a template is free and deterministic. Saving, versioning, collecting, connecting, and recording runs requires your SONARA account and workspace access.",
      sections: templates.map((item) => promptCard(item, brandCard, linkAction)),
      actions: [
        linkAction("/api/prompt-library/catalog", "Catalog JSON"),
        linkAction("/business-builder/prompts", "Business prompts"),
        linkAction("/creator-studio/prompts", "Creator prompts"),
        linkAction("/growth-studio/prompts", "Growth prompts")
      ]
    }));
  });

  app.get("/prompt-library/:slug", (req, res, next) => {
    const item = getPromptTemplate(req.params.slug);
    if (!item) return next();
    return res.status(200).type("html").send(layout({
      title: item.title,
      eyebrow: `${item.productLabel} · ${display(item.category)}`,
      heading: item.title,
      body: item.description,
      sections: [
        brandCard("Template variables", item.requiredVariables.join(", ")),
        brandCard("Compatibility", `Provider-neutral. Output: ${item.outputFormat}. Tags: ${item.tags.join(", ")}.`),
        renderForm(item)
      ],
      actions: [linkAction("/prompt-library", "Prompt Library")]
    }));
  });

  app.post("/prompt-library/:slug/render", (req, res, next) => {
    const item = getPromptTemplate(req.params.slug);
    if (!item) return next();
    const result = renderPrompt(item, req.body || {});
    if (!result.ok) return res.status(400).type("html").send(responsePage("Prompt needs attention", formatRenderError(result), "/prompt-library/" + item.slug));
    return res.status(200).type("html").send(layout({
      title: `${item.title} preview`,
      eyebrow: "Deterministic preview",
      heading: "Your instruction is ready",
      body: "This is a rendered instruction template. No AI provider was called and no record was saved.",
      sections: [
        `<article class="card"><h2>Rendered instruction</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(result.renderedPrompt)}</pre></article>`,
        brandCard("Evidence", `Fingerprint ${result.fingerprint}. ${result.characterCount} characters.`)
      ],
      actions: [linkAction(`/prompt-library/${item.slug}`, "Edit values"), linkAction("/prompt-library", "Prompt Library")]
    }));
  });

  app.get("/api/prompt-library/catalog", (req, res) => {
    const productArea = normalizeProductArea(req.query.product);
    const templates = listPromptTemplates({ productArea, category: req.query.category, query: req.query.q });
    return res.status(200).json({
      ok: true,
      count: templates.length,
      source: "sonara_original",
      templates: templates.map(publicTemplateRecord)
    });
  });

  app.get("/api/prompt-library/discovery", (req, res) => {
    const summary = getPromptLibrarySummary();
    return res.status(200).json({
      ok: true,
      protocol: "sonara.prompt-library.discovery.v1",
      description: "Portable prompt discovery metadata. This endpoint is not advertised as a full MCP server.",
      capabilities: ["catalog", "render", "saved_templates", "versions", "collections", "connections", "run_records", "import_review"],
      routes: {
        catalog: "/api/prompt-library/catalog",
        render: "/api/prompt-library/render",
        savedTemplates: "/api/prompt-library/templates",
        collections: "/api/prompt-library/collections",
        connections: "/api/prompt-library/connections",
        runs: "/api/prompt-library/runs"
      },
      summary
    });
  });

  app.post("/api/prompt-library/render", (req, res) => {
    const item = getPromptTemplate(req.body?.slug || req.body?.templateSlug || req.body?.template_slug);
    if (!item) return res.status(404).json({ ok: false, code: "template_not_found" });
    const result = renderPrompt(item, req.body?.values || req.body?.inputValues || req.body?.input_values || {});
    return res.status(result.ok ? 200 : 400).json(result);
  });

  const promptPageDeps = { requireWorkspaceAccess, layout, brandCard, linkAction, escapeHtml, getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders };
  registerWorkspacePage(app, "business_builder", promptPageDeps);
  registerWorkspacePage(app, "creator_studio", promptPageDeps);
  registerWorkspacePage(app, "growth_studio", promptPageDeps);

  app.get("/api/prompt-library/templates", selectWorkspace(requireWorkspaceAccess, (req) => req.query.product), async (req, res) => {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const visibility = promptVisibilityQuery(req.sonaraUser?.id, true);
    if (!visibility.ok) return res.status(401).json(visibility);
    const query = `?organization_id=eq.${context.organizationId}&product_area=eq.${req.promptProductArea}&${visibility.query}&select=*&order=updated_at.desc&limit=100`;
    const result = await restRequest(context, "sonara_prompt_templates", query);
    return res.status(result.ok ? 200 : 503).json(result.ok ? { ok: true, templates: result.rows } : result);
  });

  app.post("/api/prompt-library/templates", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const validation = validatePromptRecord(req.body || {});
    if (!validation.ok) return res.status(400).json({ ok: false, code: "validation_failed", errors: validation.errors, safety: validation.safety });
    if (validation.record.productArea !== req.promptProductArea) return res.status(400).json({ ok: false, code: "product_mismatch" });
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);

    const record = {
      organization_id: context.organizationId,
      created_by: req.sonaraUser?.id || null,
      product_area: validation.record.productArea,
      title: validation.record.title,
      slug: validation.record.slug,
      description: validation.record.description,
      content: validation.record.content,
      prompt_type: validation.record.promptType,
      visibility: validation.record.visibility,
      status: validation.record.status,
      input_schema: validation.record.inputSchema,
      output_schema: validation.record.outputSchema,
      model_compatibility: validation.record.modelCompatibility,
      mcp_compatibility: validation.record.mcpCompatibility,
      tags: validation.record.tags,
      source_type: validation.record.sourceType,
      source_repository: validation.record.sourceRepository,
      source_commit: validation.record.sourceCommit,
      license_status: validation.record.licenseStatus,
      provenance: validation.record.provenance,
      moderation: validation.safety
    };
    const result = await restRequest(context, "sonara_prompt_templates", "", { method: "POST", body: record, prefer: "return=representation" });
    if (!result.ok) return res.status(503).json(result);
    const saved = result.rows?.[0] || record;
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_template_created", { prompt_template_id: saved.id || null, product_area: validation.record.productArea });
    return res.status(201).json({ ok: true, code: "saved", template: saved });
  });

  app.post("/api/prompt-library/templates/:id/versions", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ ok: false, code: "invalid_template_id" });
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const existing = await getOwnedRecord(context, "sonara_prompt_templates", req.params.id, req.sonaraUser?.id);
    if (!existing.ok) return res.status(ownedRecordStatus(existing)).json(existing);
    if (existing.row.product_area !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });

    const validation = validatePromptRecord({
      ...existing.row,
      title: req.body?.title || existing.row.title,
      content: req.body?.content,
      productArea: existing.row.product_area,
      visibility: existing.row.visibility,
      status: req.body?.status || existing.row.status,
      promptType: existing.row.prompt_type,
      inputSchema: {},
      outputSchema: existing.row.output_schema,
      modelCompatibility: existing.row.model_compatibility,
      mcpCompatibility: existing.row.mcp_compatibility,
      tags: existing.row.tags
    });
    if (!validation.ok) return res.status(400).json({ ok: false, code: "validation_failed", errors: validation.errors, safety: validation.safety });

    const rpc = await rpcRequest(context, "create_sonara_prompt_version", {
      p_template_id: req.params.id,
      p_title: validation.record.title,
      p_content: validation.record.content,
      p_change_note: String(req.body?.changeNote || req.body?.change_note || "Updated through SONARA Prompt Library").slice(0, 500),
      p_status: validation.record.status
    });
    if (!rpc.ok) return res.status(503).json(rpc);
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_template_version_created", { prompt_template_id: req.params.id });
    return res.status(200).json({ ok: true, code: "version_created", version: rpc.rows?.[0] || rpc.rows });
  });

  app.post("/api/prompt-library/runs", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const values = req.body?.values || req.body?.inputValues || req.body?.input_values || {};
    const sensitive = detectSensitivePayload(values);
    if (sensitive.length) return res.status(400).json({ ok: false, code: "protected_data_detected", findings: sensitive });

    let source;
    let templateId = null;
    const builtin = getPromptTemplate(req.body?.slug || req.body?.templateSlug || req.body?.template_slug);
    if (builtin) {
      if (builtin.productArea !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });
      source = builtin;
    } else if (isUuid(req.body?.templateId || req.body?.template_id)) {
      templateId = req.body?.templateId || req.body?.template_id;
      const owned = await getOwnedRecord(context, "sonara_prompt_templates", templateId, req.sonaraUser?.id);
      if (!owned.ok) return res.status(ownedRecordStatus(owned)).json(owned);
      if (owned.row.product_area !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });
      source = {
        slug: owned.row.slug,
        title: owned.row.title,
        content: owned.row.content,
        requiredVariables: owned.row.input_schema?.required || undefined,
        currentVersion: owned.row.current_version
      };
    } else {
      return res.status(400).json({ ok: false, code: "template_required" });
    }

    const rendered = renderPrompt(source, values);
    if (!rendered.ok) return res.status(400).json(rendered);
    const record = {
      organization_id: context.organizationId,
      template_id: templateId,
      created_by: req.sonaraUser?.id || null,
      product_area: req.promptProductArea,
      source_slug: source.slug || null,
      template_version: source.currentVersion || 1,
      input_values: rendered.values,
      rendered_prompt: rendered.renderedPrompt,
      prompt_fingerprint: rendered.fingerprint,
      model_slug: String(req.body?.modelSlug || req.body?.model_slug || "provider_neutral").slice(0, 120),
      status: "prepared",
      output_payload: {},
      execution_metadata: { providerCalled: false, savedBy: "sonara_prompt_library" }
    };
    const result = await restRequest(context, "sonara_prompt_runs", "", { method: "POST", body: record, prefer: "return=representation" });
    if (!result.ok) return res.status(503).json(result);
    const saved = result.rows?.[0] || record;
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_run_prepared", { prompt_run_id: saved.id || null, product_area: req.promptProductArea });
    return res.status(201).json({ ok: true, code: "prepared_and_saved", providerCalled: false, run: saved });
  });

  app.get("/api/prompt-library/collections", selectWorkspace(requireWorkspaceAccess, (req) => req.query.product), async (req, res) => {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const visibility = promptVisibilityQuery(req.sonaraUser?.id, false);
    if (!visibility.ok) return res.status(401).json(visibility);
    const query = `?organization_id=eq.${context.organizationId}&product_area=eq.${req.promptProductArea}&${visibility.query}&select=*,sonara_prompt_collection_items(*)&order=updated_at.desc&limit=100`;
    const result = await restRequest(context, "sonara_prompt_collections", query);
    return res.status(result.ok ? 200 : 503).json(result.ok ? { ok: true, collections: result.rows } : result);
  });

  app.post("/api/prompt-library/collections", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 160);
    if (!name) return res.status(400).json({ ok: false, code: "name_required" });
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const result = await restRequest(context, "sonara_prompt_collections", "", {
      method: "POST",
      prefer: "return=representation",
      body: {
        organization_id: context.organizationId,
        created_by: req.sonaraUser?.id || null,
        product_area: req.promptProductArea,
        name,
        description: String(req.body?.description || "").trim().slice(0, 1000) || null,
        visibility: ["private", "organization"].includes(req.body?.visibility) ? req.body.visibility : "private"
      }
    });
    return res.status(result.ok ? 201 : 503).json(result.ok ? { ok: true, collection: result.rows?.[0] } : result);
  });

  app.post("/api/prompt-library/collections/:id/items", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const templateId = req.body?.templateId || req.body?.template_id;
    if (!isUuid(req.params.id) || !isUuid(templateId)) return res.status(400).json({ ok: false, code: "invalid_id" });
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const collection = await getOwnedRecord(context, "sonara_prompt_collections", req.params.id, req.sonaraUser?.id);
    const prompt = await getOwnedRecord(context, "sonara_prompt_templates", templateId, req.sonaraUser?.id);
    if (!collection.ok) return res.status(ownedRecordStatus(collection)).json(collection);
    if (!prompt.ok) return res.status(ownedRecordStatus(prompt)).json(prompt);
    if (collection.row.product_area !== req.promptProductArea || prompt.row.product_area !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });
    const result = await restRequest(context, "sonara_prompt_collection_items", "", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: {
        organization_id: context.organizationId,
        collection_id: req.params.id,
        template_id: templateId,
        item_order: normalizeInteger(req.body?.order, 0, 999, 0)
      }
    });
    return res.status(result.ok ? 201 : 503).json(result.ok ? { ok: true, item: result.rows?.[0] } : result);
  });

  app.post("/api/prompt-library/connections", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const validation = validateConnection(req.body || {});
    if (!validation.ok || !isUuid(validation.record.sourceId) || !isUuid(validation.record.targetId)) return res.status(400).json({ ok: false, code: "validation_failed", errors: validation.errors.length ? validation.errors : ["sourceId and targetId must be UUIDs."] });
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const source = await getOwnedRecord(context, "sonara_prompt_templates", validation.record.sourceId, req.sonaraUser?.id);
    const target = await getOwnedRecord(context, "sonara_prompt_templates", validation.record.targetId, req.sonaraUser?.id);
    if (!source.ok) return res.status(ownedRecordStatus(source)).json(source);
    if (!target.ok) return res.status(ownedRecordStatus(target)).json(target);
    if (source.row.product_area !== req.promptProductArea || target.row.product_area !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });
    const result = await restRequest(context, "sonara_prompt_connections", "", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: {
        organization_id: context.organizationId,
        source_template_id: validation.record.sourceId,
        target_template_id: validation.record.targetId,
        label: validation.record.label,
        connection_order: validation.record.order
      }
    });
    return res.status(result.ok ? 201 : 503).json(result.ok ? { ok: true, connection: result.rows?.[0] } : result);
  });

  app.get("/admin/prompt-library", requireAdmin, async (req, res) => {
    const readiness = await getReadiness(safeListTable, true);
    await recordAdminAuditEvent(req, "admin.prompt_library.dashboard", { tableCount: PROMPT_LIBRARY_TABLES.length, readyCount: readiness.tables.filter((item) => item.ok).length });
    return res.status(200).type("html").send(layout({
      title: "Prompt Library Control Plane",
      eyebrow: "Founder operations",
      heading: "Prompt Library Control Plane",
      body: "Govern the shared prompt architecture, database readiness, source provenance, moderation, imports, versions, collections, workflows, and run records.",
      sections: [
        brandCard("Architecture", `${BUILTIN_PROMPT_TEMPLATES.length} original starter templates across all three studios. ${PROMPT_LIBRARY_TABLES.length} organization-scoped database tables.`),
        brandCard("Source boundary", "prompts.chat is pinned as an MIT/CC0 research and optional import source. Its separate app, authentication, remote MCP endpoint, telemetry, and deployment stack are not installed."),
        brandCard("Database readiness", readiness.tables.map((item) => `${item.table}: ${item.ok ? "ready" : "setup required"}`).join(" / ")),
        brandCard("Import gate", "Imports require a pinned commit, CC0 or approved MIT evidence, moderation, deduplication, provenance, tenant-safe storage, owner approval, and rollback manifest.")
      ],
      actions: [
        linkAction("/api/admin/prompt-library/readiness", "Readiness JSON"),
        linkAction("/api/prompt-library/catalog", "Catalog JSON"),
        linkAction("/admin/ecosystem", "Ecosystem"),
        linkAction("/admin", "Founder operations")
      ]
    }));
  });

  app.get("/api/admin/prompt-library/readiness", requireAdmin, async (req, res) => {
    const readiness = await getReadiness(safeListTable, true);
    await recordAdminAuditEvent(req, "admin.prompt_library.readiness", { tableCount: readiness.tables.length, readyCount: readiness.tables.filter((item) => item.ok).length });
    return res.status(200).json({ ok: true, ...getPromptLibrarySummary(), readiness });
  });

  app.post("/api/admin/prompt-library/import-review", requireAdmin, async (req, res) => {
    const review = reviewImportBatch(req.body || {});
    await recordAdminAuditEvent(req, "admin.prompt_library.import_review", { sourceRepository: req.body?.sourceRepository || req.body?.source_repository || null, decision: review.decision, recordCount: review.recordCount });
    return res.status(review.ok ? 200 : 400).json(review);
  });
};

function registerWorkspacePage(app, productArea, deps) {
  const { requireWorkspaceAccess, layout, brandCard, linkAction, escapeHtml, getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders } = deps;
  const path = `/${productArea.replace("_", "-")}/prompts`;

  // A customer's own saved templates and collections.
  //
  // This page listed the starter templates and then offered two links labelled
  // "My saved templates JSON" and "My collections JSON". Clicking either gave a
  // wall of JSON, and it was the only way to see anything you had saved.
  //
  // Returns "" on any failure, so the starter templates still render.
  async function savedWorkCards(req) {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders }).catch(() => ({ ok: false }));
    if (!context.ok) return "";
    const visibility = promptVisibilityQuery(req.sonaraUser?.id, false);
    if (!visibility.ok) return "";

    const scope = `?organization_id=eq.${context.organizationId}&product_area=eq.${productArea}&${visibility.query}`;
    const [templates, collections] = await Promise.all([
      restRequest(context, "sonara_prompt_templates", `${scope}&select=id,title,updated_at&order=updated_at.desc&limit=20`).catch(() => ({ ok: false })),
      restRequest(context, "sonara_prompt_collections", `${scope}&select=id,name,updated_at&order=updated_at.desc&limit=20`).catch(() => ({ ok: false }))
    ]);

    const cards = [];
    const saved = templates.ok ? templates.rows || [] : [];
    const sets = collections.ok ? collections.rows || [] : [];

    if (saved.length) {
      cards.push(`<article class="card"><h2>Your saved instructions</h2>${saved
        .map((row) => `<p>${escapeHtml(String(row.title || "Untitled"))}</p>`)
        .join("")}</article>`);
    }
    if (sets.length) {
      cards.push(`<article class="card"><h2>Your collections</h2>${sets
        .map((row) => `<p>${escapeHtml(String(row.name || "Untitled collection"))}</p>`)
        .join("")}</article>`);
    }
    if (!cards.length && (templates.ok || collections.ok)) {
      cards.push('<article class="card"><h2>Your saved instructions</h2><p>Nothing saved yet. Anything you save here will be private to your workspace and listed on this page.</p></article>');
    }
    return cards.join("");
  }

  app.get(path, requireWorkspaceAccess(productArea), async (req, res) => {
    const templates = listPromptTemplates({ productArea });
    const savedWork = await savedWorkCards(req);
    return res.status(200).type("html").send(layout({
      title: `${PRODUCT_LABELS[productArea]} Prompt Library`,
      eyebrow: PRODUCT_LABELS[productArea],
      heading: "Prompt Library",
      body: "Use these starter instructions straight away, or save your own. Anything you save stays private to your workspace.",
      sections: [...(savedWork ? [savedWork] : []), ...templates.map((item) => promptCard(item, brandCard, linkAction))],
      actions: [linkAction("/prompt-library", "Public Prompt Library")]
    }));
  });
}

function publicTemplateRecord(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    productArea: item.productArea,
    productLabel: item.productLabel,
    category: item.category,
    description: item.description,
    content: item.content,
    promptType: item.promptType,
    variables: item.requiredVariables,
    outputFormat: item.outputFormat,
    modelCompatibility: item.modelCompatibility,
    tags: item.tags,
    version: item.currentVersion,
    fingerprint: item.fingerprint,
    license: item.license
  };
}

function promptCard(item, brandCard, linkAction) {
  return brandCard(item.title, `${item.description} Variables: ${item.requiredVariables.join(", ")}. ${linkAction(`/prompt-library/${item.slug}`, "Open template")}`);
}

function renderForm(item) {
  const fields = item.requiredVariables.map((variable) => `<label style="display:grid;gap:.4rem;margin:.8rem 0"><strong>${esc(display(variable))}</strong><textarea name="${esc(variable)}" maxlength="6000" required rows="3"></textarea></label>`).join("");
  return `<article class="card"><h2>Fill the template</h2><form method="post" action="/prompt-library/${esc(item.slug)}/render">${fields}<button class="action" type="submit">Create instruction preview</button></form></article>`;
}

async function customerContext(req, deps) {
  if (!deps.getSupabaseServerConfig || !deps.supabaseHeaders) return { ok: false, code: "setup_required", service: "supabase" };
  const config = deps.getSupabaseServerConfig();
  if (!config?.ok) return { ok: false, code: "setup_required", service: "supabase" };
  if (!deps.getCustomerPrimaryOrganization) return { ok: false, code: "setup_required", service: "organization" };
  const organization = await deps.getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization?.ok) return { ok: false, code: "setup_required", service: "customer_organization", reason: organization?.code };
  return {
    ok: true,
    config,
    headers: (options) => deps.supabaseHeaders(config, options),
    organizationId: organization.organizationId
  };
}

async function restRequest(context, table, query = "", options = {}) {
  const response = await fetch(`${context.config.url}/rest/v1/${table}${query}`, {
    method: options.method || "GET",
    headers: context.headers(options.prefer ? { prefer: options.prefer } : undefined),
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "database_unavailable", table, status: response?.status || "unavailable" };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : rows ? [rows] : [] };
}

async function rpcRequest(context, functionName, body) {
  const response = await fetch(`${context.config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: context.headers({ prefer: "return=representation" }),
    body: JSON.stringify(body)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "database_rpc_unavailable", functionName, status: response?.status || "unavailable" };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : rows ? [rows] : [] };
}

async function getOwnedRecord(context, table, id, userId) {
  const query = `?id=eq.${encodeURIComponent(id)}&organization_id=eq.${context.organizationId}&select=*&limit=1`;
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
    query: `or=(${shared},and(visibility.eq.private,created_by.eq.${creator}))`
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
}

function selectWorkspace(requireWorkspaceAccess, resolver) {
  return (req, res, next) => {
    const productArea = normalizeProductArea(resolver(req));
    if (!productArea) return res.status(400).json({ ok: false, code: "product_required", allowed: Object.keys(PRODUCT_LABELS) });
    req.promptProductArea = productArea;
    return requireWorkspaceAccess(productArea)(req, res, next);
  };
}

async function getReadiness(safeListTable, live) {
  if (!safeListTable || live !== true) return { mode: "static", tables: PROMPT_LIBRARY_TABLES.map((table) => ({ table, ok: false, status: "setup_required" })) };
  const tables = await Promise.all(PROMPT_LIBRARY_TABLES.map(async (table) => {
    const result = await bounded(() => safeListTable(table, "?select=id&limit=1"), LIVE_PROBE_TIMEOUT_MS);
    return { table, ok: Boolean(result?.ok), status: result?.ok ? "ready" : "setup_required", reason: result?.code || undefined };
  }));
  return { mode: "live_bounded", probeTimeoutMs: LIVE_PROBE_TIMEOUT_MS, tables };
}

async function bounded(run, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run).catch(() => ({ ok: false, code: "unavailable" })),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, code: "timeout" }), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function detectSensitivePayload(value) {
  const text = JSON.stringify(value || {});
  const findings = [];
  const checks = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "private_key"],
    [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/, "provider_secret_key"],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, "github_token"],
    [/\bsb_secret_[A-Za-z0-9_-]{12,}\b/, "supabase_secret"],
    [/\b(?:password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i, "credential_like_value"],
    [/\b(?:cvv|cvc|card security code|security code)\b\s*[:=]?\s*[0-9]{3,4}\b/i, "payment_card_security_code"],
    [/(?:%B|;)\d{13,19}(?:\^|=)/i, "payment_card_track_data"]
  ];
  for (const [pattern, name] of checks) if (pattern.test(text)) findings.push(name);

  const cardCandidates = text.match(/(?:\d[ -]?){13,19}/g) || [];
  for (const candidate of cardCandidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      findings.push("payment_card_number");
      break;
    }
  }

  if (/\b(?:card(?: number)?|pan)\b\s*[:=]?\s*(?:\d[ -]?){13,19}/i.test(text)) {
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
}

function formatRenderError(result) {
  if (result.code === "missing_variables") return `Complete these required fields: ${(result.missing || []).join(", ")}.`;
  if (result.code === "value_too_large") return `${result.variable} is too long.`;
  if (result.code === "protected_variable_name") return `${result.variable} is not an allowed template variable.`;
  return "The template could not be rendered safely.";
}

function normalizeInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function display(value) {
  return String(value || "").replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${body}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function responsePage(title, message, returnPath) { return `<!doctype html><html><head><title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${esc(title)}</h1><p>${esc(message)}</p><a href="${esc(returnPath)}">Return</a></main></body></html>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
