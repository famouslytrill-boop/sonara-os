// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  PRODUCT_LABELS,
  getPromptLibrarySummary,
  getPromptTemplate,
  listPromptTemplates,
  normalizeProductArea,
  renderPrompt,
  validateConnection,
  validatePromptRecord
} = require("../lib/sonara-prompt-library.cjs");
const { escapeHtml } = require("../lib/sonara-shell.cjs");
const pages = require("../lib/sonara-prompt-library-pages.cjs");


module.exports = function registerSonaraPromptLibraryRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const getSupabaseServerConfig = typeof deps.getSupabaseServerConfig === "function" ? deps.getSupabaseServerConfig : undefined;
  const getCustomerPrimaryOrganization = typeof deps.getCustomerPrimaryOrganization === "function" ? deps.getCustomerPrimaryOrganization : undefined;
  const supabaseHeaders = typeof deps.supabaseHeaders === "function" ? deps.supabaseHeaders : undefined;
  const insertActivityEvent = typeof deps.insertActivityEvent === "function" ? deps.insertActivityEvent : async () => ({ ok: false });

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
    const query = `?organization_id=eq.${encodeURIComponent(context.organizationId)}&product_area=eq.${encodeURIComponent(req.promptProductArea)}&${visibility.query}&select=*&order=updated_at.desc&limit=100`;
    const result = await restRequest(context, "sonara_prompt_templates", query);
    return res.status(result.ok ? 200 : 503).json(result.ok ? { ok: true, templates: result.rows } : result);
  });

  app.post("/api/prompt-library/templates", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    // A form sends tags as one comma-separated field; the API takes a list.
    const input = wantsHtml(req) ? { ...req.body, tags: splitTags(req.body?.tags) } : (req.body || {});
    const validation = validatePromptRecord(input);
    if (!validation.ok) return refuse(req, res, 400, { ok: false, code: "validation_failed", errors: validation.errors, safety: validation.safety }, layout, linkAction);
    if (validation.record.productArea !== req.promptProductArea) return refuse(req, res, 400, { ok: false, code: "product_mismatch" }, layout, linkAction);
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return respond(req, res, 503, context, "template");

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
    if (!result.ok) return respond(req, res, 503, result, "template");
    const saved = result.rows?.[0] || record;
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_template_created", { prompt_template_id: saved.id || null, product_area: validation.record.productArea });
    return respond(req, res, 201, { ok: true, code: "saved", template: saved }, "template");
  });

  app.post("/api/prompt-library/templates/:id/versions", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    if (!isUuid(req.params.id)) return respond(req, res, 400, { ok: false, code: "invalid_id" }, "version");
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return respond(req, res, 503, context, "version");
    const existing = await getOwnedRecord(context, "sonara_prompt_templates", req.params.id, req.sonaraUser?.id);
    if (!existing.ok) return respond(req, res, ownedRecordStatus(existing), existing, "version");
    if (existing.row.product_area !== req.promptProductArea) return respond(req, res, 403, { ok: false, code: "workspace_mismatch" }, "version");

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
    if (!validation.ok) return refuse(req, res, 400, { ok: false, code: "validation_failed", errors: validation.errors, safety: validation.safety }, layout, linkAction);

    const rpc = await rpcRequest(context, "create_sonara_prompt_version", {
      p_template_id: req.params.id,
      p_title: validation.record.title,
      p_content: validation.record.content,
      p_change_note: String(req.body?.changeNote || req.body?.change_note || "Updated through SONARA Prompt Library").slice(0, 500),
      p_status: validation.record.status
    });
    if (!rpc.ok) return respond(req, res, 503, rpc, "version");
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_template_version_created", { prompt_template_id: req.params.id });
    return respond(req, res, 200, { ok: true, code: "version_created", version: rpc.rows?.[0] || rpc.rows }, "version");
  });

  app.post("/api/prompt-library/runs", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return respond(req, res, 503, context, "run");
    // A form sends one value_<variable> field per value; the API takes an object.
    const values = req.body?.values || req.body?.inputValues || req.body?.input_values || valuesFromForm(req.body);
    const sensitive = detectSensitivePayload(values);
    if (sensitive.length) return respond(req, res, 400, { ok: false, code: "protected_data_detected", findings: sensitive }, "run");

    let source;
    let templateId = null;
    const builtin = getPromptTemplate(req.body?.slug || req.body?.templateSlug || req.body?.template_slug);
    if (builtin) {
      if (builtin.productArea !== req.promptProductArea) return res.status(403).json({ ok: false, code: "workspace_mismatch" });
      source = builtin;
    } else if (isUuid(req.body?.templateId || req.body?.template_id)) {
      templateId = req.body?.templateId || req.body?.template_id;
      const owned = await getOwnedRecord(context, "sonara_prompt_templates", templateId, req.sonaraUser?.id);
      if (!owned.ok) return respond(req, res, ownedRecordStatus(owned), owned, "run");
      if (owned.row.product_area !== req.promptProductArea) return respond(req, res, 403, { ok: false, code: "workspace_mismatch" }, "run");
      source = {
        slug: owned.row.slug,
        title: owned.row.title,
        content: owned.row.content,
        requiredVariables: owned.row.input_schema?.required || undefined,
        currentVersion: owned.row.current_version
      };
    } else {
      return respond(req, res, 400, { ok: false, code: "template_required" }, "run");
    }

    const rendered = renderPrompt(source, values);
    if (!rendered.ok) return respond(req, res, 400, rendered, "run");
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
    if (!result.ok) return respond(req, res, 503, result, "run");
    const saved = result.rows?.[0] || record;
    await insertActivityEvent(context.organizationId, req.sonaraUser?.id, "sonara.prompt_run_prepared", { prompt_run_id: saved.id || null, product_area: req.promptProductArea });
    // A browser is shown the prepared instruction: it was what they asked for,
    // and a redirect would have to carry it in an address.
    if (wantsHtml(req)) {
      const back = backFrom(req, `/${req.promptProductArea.replace("_", "-")}/prompts`);
      return res.status(201).type("html").send(layout({
        title: "Prepared instruction",
        eyebrow: PRODUCT_LABELS[req.promptProductArea],
        heading: "Your instruction is ready",
        body: "Copy it into the tool you use. It was recorded as a prepared use; no AI provider was called.",
        sections: [pages.preparedCard(saved, escapeHtml)],
        actions: [linkAction(back, "Back to the instruction")]
      }));
    }
    return res.status(201).json({ ok: true, code: "prepared_and_saved", providerCalled: false, run: saved });
  });

  app.get("/api/prompt-library/collections", selectWorkspace(requireWorkspaceAccess, (req) => req.query.product), async (req, res) => {
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return res.status(503).json(context);
    const visibility = promptVisibilityQuery(req.sonaraUser?.id, false);
    if (!visibility.ok) return res.status(401).json(visibility);
    const query = `?organization_id=eq.${encodeURIComponent(context.organizationId)}&product_area=eq.${encodeURIComponent(req.promptProductArea)}&${visibility.query}&select=*,sonara_prompt_collection_items(*)&order=updated_at.desc&limit=100`;
    const result = await restRequest(context, "sonara_prompt_collections", query);
    return res.status(result.ok ? 200 : 503).json(result.ok ? { ok: true, collections: result.rows } : result);
  });

  app.post("/api/prompt-library/collections", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 160);
    if (!name) return respond(req, res, 400, { ok: false, code: "name_required" }, "collection");
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return respond(req, res, 503, context, "collection");
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
    return respond(req, res, result.ok ? 201 : 503, result.ok ? { ok: true, collection: result.rows?.[0] } : result, "collection");
  });

  app.post("/api/prompt-library/collections/:id/items", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const result = await addCollectionItem(req, req.params.id, req.body?.templateId || req.body?.template_id, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    return respond(req, res, result.status, result.body, "collection_item");
  });

  app.post("/api/prompt-library/connections", selectWorkspace(requireWorkspaceAccess, (req) => req.body?.productArea || req.body?.product_area), async (req, res) => {
    const validation = validateConnection(req.body || {});
    if (!validation.ok || !isUuid(validation.record.sourceId) || !isUuid(validation.record.targetId)) return refuse(req, res, 400, { ok: false, code: "validation_failed", errors: validation.errors.length ? validation.errors : ["sourceId and targetId must be UUIDs."] }, layout, linkAction);
    const context = await customerContext(req, { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders });
    if (!context.ok) return respond(req, res, 503, context, "connection");
    const source = await getOwnedRecord(context, "sonara_prompt_templates", validation.record.sourceId, req.sonaraUser?.id);
    const target = await getOwnedRecord(context, "sonara_prompt_templates", validation.record.targetId, req.sonaraUser?.id);
    if (!source.ok) return respond(req, res, ownedRecordStatus(source), source, "connection");
    if (!target.ok) return respond(req, res, ownedRecordStatus(target), target, "connection");
    if (source.row.product_area !== req.promptProductArea || target.row.product_area !== req.promptProductArea) return respond(req, res, 403, { ok: false, code: "workspace_mismatch" }, "connection");
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
    return respond(req, res, result.ok ? 201 : 503, result.ok ? { ok: true, connection: result.rows?.[0] } : result, "connection");
  });

      };

function registerWorkspacePage(app, productArea, deps) {
  const { requireWorkspaceAccess, layout, brandCard, linkAction, escapeHtml, getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders } = deps;
  const path = `/${productArea.replace("_", "-")}/prompts`;
  const contextDeps = { getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders };

  // The workspace's own instructions and collections, with the forms that make
  // them, above the starter set. Each list carries its read outcome: a list
  // that could not be read says so rather than reading as "nothing saved".
  async function savedWork(req) {
    const context = await customerContext(req, contextDeps).catch(() => ({ ok: false }));
    const visibility = promptVisibilityQuery(req.sonaraUser?.id, false);
    if (!context.ok || !visibility.ok) return { templates: { ok: false, rows: [] }, collections: { ok: false, rows: [] } };
    const scope = `?organization_id=eq.${encodeURIComponent(context.organizationId)}&product_area=eq.${encodeURIComponent(productArea)}&${visibility.query}`;
    const [templates, collections] = await Promise.all([
      restRequest(context, "sonara_prompt_templates", `${scope}&select=id,title,prompt_type,visibility,current_version&order=updated_at.desc&limit=100`).catch(() => ({ ok: false, rows: [] })),
      restRequest(context, "sonara_prompt_collections", `${scope}&select=id,name,description,visibility&order=updated_at.desc&limit=100`).catch(() => ({ ok: false, rows: [] }))
    ]);
    return { templates, collections };
  }

  app.get(path, requireWorkspaceAccess(productArea), async (req, res) => {
    const templates = listPromptTemplates({ productArea });
    const saved = await savedWork(req);
    const options = { productArea, back: path, base: path, escape: escapeHtml };
    return res.status(200).type("html").send(layout({
      title: `${PRODUCT_LABELS[productArea]} Prompt Library`,
      eyebrow: PRODUCT_LABELS[productArea],
      heading: "Prompt Library",
      body: "Use these starter instructions straight away, or save your own. Anything you save stays private to you or your workspace.",
      sections: [
        pages.notice(req.query, escapeHtml),
        pages.savedInstructionsCard(saved.templates, options),
        pages.collectionsCard(saved.collections, options),
        ...templates.map((item) => promptCard(item, brandCard, linkAction))
      ].filter(Boolean),
      actions: [linkAction("/prompt-library", "Public Prompt Library")]
    }));
  });

  // One saved instruction: what it says, and the forms that use it, version it,
  // collect it and connect it.
  app.get(`${path}/:templateId`, requireWorkspaceAccess(productArea), async (req, res) => {
    const unavailable = (status, message) => res.status(status).type("html").send(layout({
      title: "Saved instruction",
      eyebrow: PRODUCT_LABELS[productArea],
      heading: "Not available",
      body: message,
      sections: [],
      actions: [linkAction(path, "Prompt Library")]
    }));
    if (!isUuid(req.params.templateId)) return unavailable(404, "That instruction is not in this workspace.");
    const context = await customerContext(req, contextDeps).catch(() => ({ ok: false }));
    if (!context.ok) return unavailable(503, "Your workspace is not connected yet, so there is nothing to show.");
    const owned = await getOwnedRecord(context, "sonara_prompt_templates", req.params.templateId, req.sonaraUser?.id);
    if (!owned.ok) return unavailable(owned.code === "not_found" || owned.code === "forbidden" ? 404 : 502, owned.code === "not_found" || owned.code === "forbidden" ? "That instruction is not in this workspace." : "We could not read that instruction just now. Nothing has changed.");
    const row = owned.row;
    // Opened under another studio's path -- an old link, or one copied between
    // studios -- it is still this workspace's instruction, so send the person to
    // where it lives. That page applies its own studio's access check. A studio
    // this server does not know is not somewhere to send anybody.
    if (row.product_area !== productArea) {
      if (PRODUCT_LABELS[row.product_area]) return res.redirect(303, `/${row.product_area.replace("_", "-")}/prompts/${encodeURIComponent(row.id)}`);
      return unavailable(404, "That instruction is not in this workspace.");
    }
    const saved = await savedWork(req);
    const runs = await restRequest(context, "sonara_prompt_runs", `?organization_id=eq.${encodeURIComponent(context.organizationId)}&template_id=eq.${encodeURIComponent(row.id)}&select=id,created_at,template_version,prompt_fingerprint&order=created_at.desc&limit=10`).catch(() => ({ ok: false, rows: [] }));
    const back = `${path}/${row.id}`;
    const options = { productArea, back, base: path, escape: escapeHtml };
    return res.status(200).type("html").send(layout({
      title: `${row.title || "Saved instruction"} | Prompt Library`,
      eyebrow: PRODUCT_LABELS[productArea],
      heading: row.title || "Saved instruction",
      body: row.description || "One of your workspace's saved instructions.",
      sections: [
        pages.notice(req.query, escapeHtml),
        pages.instructionCard(row, escapeHtml),
        pages.runForm(row, options),
        pages.versionForm(row, options),
        pages.addToCollectionForm(row, saved.collections, options),
        pages.connectForm(row, saved.templates, options),
        pages.runsCard(runs, escapeHtml)
      ].filter(Boolean),
      actions: [linkAction(path, "Prompt Library")]
    }));
  });

  // Adding to a collection from the instruction's page. The JSON endpoint takes
  // the collection in its path, which a form whose collection is picked from a
  // list cannot write, so this takes it as a field and does the same thing.
  app.post(`${path}/:templateId/collections`, requireWorkspaceAccess(productArea), async (req, res) => {
    req.promptProductArea = productArea;
    const result = await addCollectionItem(req, req.body?.collection_id, req.params.templateId, contextDeps);
    return respond(req, res, result.status, result.body, "collection_item");
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
  const query = `?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(context.organizationId)}&select=*&limit=1`;
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

// The outcome of a write, for whoever asked. A browser posting one of the page's
// forms is sent back to the page with a key the page translates; an API client
// gets the JSON it always got. `back` is only ever a path on this site.
function wantsHtml(req) {
  const accept = String(req.headers?.accept || "");
  return accept.includes("text/html") && !/^application\/json/.test(accept);
}

function backFrom(req, fallback) {
  const back = String(req.body?.back || "");
  return /^\/[a-z0-9/-]*$/i.test(back) && back.length <= 200 ? back : fallback;
}

function respond(req, res, status, body, done) {
  if (!wantsHtml(req)) return res.status(status).json(body);
  const fallback = req.promptProductArea ? `/${req.promptProductArea.replace("_", "-")}/prompts` : "/prompt-library";
  const back = backFrom(req, fallback);
  const outcome = body?.ok ? `done=${encodeURIComponent(done)}` : `problem=${encodeURIComponent(body?.code || "database_unavailable")}`;
  return res.redirect(303, `${back}${back.includes("?") ? "&" : "?"}${outcome}`);
}

// A refusal with reasons of this server's own: rendered as a page rather than
// carried in an address a link could forge.
function refuse(req, res, status, body, layout, linkAction) {
  if (!wantsHtml(req)) return res.status(status).json(body);
  const fallback = req.promptProductArea ? `/${req.promptProductArea.replace("_", "-")}/prompts` : "/prompt-library";
  const back = backFrom(req, fallback);
  return res.status(status).type("html").send(layout({
    title: "Not saved",
    eyebrow: "Prompt Library",
    heading: "Not saved",
    body: "Nothing was recorded. Go back, correct it and save again.",
    sections: [pages.refusalCard(body?.errors, escapeHtml)],
    actions: [linkAction(back, "Back")]
  }));
}

function splitTags(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
}

// value_<variable> fields from a form, as the { variable: value } object the
// run endpoint takes from an API client.
function valuesFromForm(body = {}) {
  const values = {};
  for (const [key, value] of Object.entries(body || {})) {
    const match = key.match(/^value_([a-zA-Z][a-zA-Z0-9_]{0,63})$/);
    if (match) values[match[1]] = String(value ?? "");
  }
  return values;
}

async function addCollectionItem(req, collectionId, templateId, deps) {
  if (!isUuid(collectionId) || !isUuid(templateId)) return { status: 400, body: { ok: false, code: "invalid_id" } };
  const context = await customerContext(req, deps);
  if (!context.ok) return { status: 503, body: context };
  const collection = await getOwnedRecord(context, "sonara_prompt_collections", collectionId, req.sonaraUser?.id);
  const prompt = await getOwnedRecord(context, "sonara_prompt_templates", templateId, req.sonaraUser?.id);
  if (!collection.ok) return { status: ownedRecordStatus(collection), body: collection };
  if (!prompt.ok) return { status: ownedRecordStatus(prompt), body: prompt };
  if (collection.row.product_area !== req.promptProductArea || prompt.row.product_area !== req.promptProductArea) return { status: 403, body: { ok: false, code: "workspace_mismatch" } };
  const result = await restRequest(context, "sonara_prompt_collection_items", "?on_conflict=collection_id,template_id", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: {
      organization_id: context.organizationId,
      collection_id: collectionId,
      template_id: templateId,
      item_order: normalizeInteger(req.body?.order, 0, 999, 0)
    }
  });
  return { status: result.ok ? 201 : 503, body: result.ok ? { ok: true, item: result.rows?.[0] } : result };
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
