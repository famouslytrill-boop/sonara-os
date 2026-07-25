"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServiceCatalogRoute();
patchSafeListTimeout();
patchEcosystemManifest();
console.log("SONARA recommended product catalog applied");

function patchServiceCatalogRoute() {
  const file = root("routes", "sonara-service-lifecycle-routes.cjs");
  let source = read(file);

  const requireLine = 'const { getRecommendedProductCatalog } = require("../lib/sonara-recommended-product-catalog.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS } = require("../lib/optional-ai-gateway.cjs");';
    requireAnchor(source, anchor, "recommended catalog require");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }

  if (source.includes("const DEFAULT_SERVICE_CATALOG = [")) {
    source = source.replace("const DEFAULT_SERVICE_CATALOG = [", "const LEGACY_DEFAULT_SERVICE_CATALOG = [");
  }

  if (!source.includes("const DEFAULT_SERVICE_CATALOG = [...getRecommendedProductCatalog(), ...LEGACY_DEFAULT_SERVICE_CATALOG];")) {
    const anchor = "function catalogCardBody(item) {";
    requireAnchor(source, anchor, "recommended catalog default");
    source = source.replace(anchor, `const DEFAULT_SERVICE_CATALOG = [...getRecommendedProductCatalog(), ...LEGACY_DEFAULT_SERVICE_CATALOG];\n\n${anchor}`);
  }

  const oldCardBody = `function catalogCardBody(item) {
  const parts = [item.summary];
  if (item.inputs) parts.push(\`Inputs: \${item.inputs}.\`);
  if (item.turnaround) parts.push(\`Turnaround: \${item.turnaround}.\`);
  if (item.deliverableType) parts.push(\`Deliverable: \${item.deliverableType}.\`);
  parts.push(\`Access: \${item.tier === "free" ? "Free tool" : "Paid service"}. Pricing: \${item.priceNote}\`);
  return parts.join(" ");
}`;
  const newCardBody = `function catalogCardBody(item) {
  const parts = [item.summary];
  if (item.customerOutcome) parts.push(\`Outcome: \${item.customerOutcome}\`);
  if (item.inputs) parts.push(\`Inputs: \${item.inputs}.\`);
  if (item.turnaround) parts.push(\`Turnaround: \${item.turnaround}.\`);
  if (item.deliverableType) parts.push(\`Deliverable: \${item.deliverableType}.\`);
  if (item.lifecycleStatus) parts.push(\`Availability: \${String(item.lifecycleStatus).replace(/_/g, " ")}.\`);
  if (item.planFloor) parts.push(\`Plan floor: \${item.planFloor}.\`);
  else parts.push(\`Access: \${item.tier === "free" ? "Free tool" : "Paid service"}.\`);
  if (item.serviceKey) {
    const lifecycleRestricted = ["planned", "validation_required", "setup_required"].includes(String(item.lifecycleStatus || ""));
    const paidVerificationRequired = item.planFloor !== "free" && item.entitlementIntegrationVerified !== true;
    if (item.executionEnabled === true && !lifecycleRestricted && !paidVerificationRequired) {
      parts.push("Execution: enabled with server-side access checks.");
    } else if (lifecycleRestricted) {
      parts.push("Execution: restricted until lifecycle evidence and launch approval are complete.");
    } else if (paidVerificationRequired) {
      parts.push("Execution: restricted until a production paid-entitlement test passes.");
    } else {
      parts.push("Execution: restricted until setup and production verification are complete.");
    }
  }
  if (item.priceNote) parts.push(\`Pricing: \${item.priceNote}\`);
  return parts.join(" ");
}`;
  if (source.includes(oldCardBody)) source = source.replace(oldCardBody, newCardBody);
  requireAnchor(source, "Execution: restricted", "catalog execution boundary");

  if (!source.includes("function catalogActions(item, product)")) {
    const anchor = newCardBody;
    requireAnchor(source, anchor, "catalog actions insertion");
    const helper = `function catalogActions(item, product) {
  const governedProduct = Boolean(item.serviceKey);
  const lifecycleRestricted = governedProduct && ["planned", "validation_required", "setup_required"].includes(String(item.lifecycleStatus || ""));
  const paidVerificationRequired = governedProduct && item.planFloor !== "free" && item.entitlementIntegrationVerified !== true;
  const canOpen = !governedProduct || (item.executionEnabled === true && !lifecycleRestricted && !paidVerificationRequired);
  const requestLabel = lifecycleRestricted
    ? "Request validation discussion"
    : paidVerificationRequired
      ? "Request access verification"
      : "Request this service";
  const actions = [linkAction("/requests", requestLabel)];
  if (canOpen) {
    const detailPath = item.route || (product ? \`/\${product.slug}\` : "/start");
    actions.push(linkAction(detailPath, governedProduct && item.planFloor !== "free" ? "Open gated product" : product ? product.name : "Open product"));
  } else {
    actions.push(linkAction("/product-lifecycle", "Review lifecycle process"));
  }
  return actions;
}`;
    source = source.replace(anchor, `${anchor}\n\n${helper}`);
  }

  const oldLoad = `    const rows = await safeListTable("service_catalog_items", "?select=id,product_key,name,summary,price_note,status&status=eq.active&order=name.asc&limit=50");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const items = usingDatabase
      ? rows.rows.map((row) => ({ productKey: row.product_key, name: row.name, summary: row.summary, tier: "paid", priceNote: row.price_note || "Scoped after intake review." }))
      : DEFAULT_SERVICE_CATALOG;`;
  const newLoad = `    const rows = await safeListTable("service_catalog_items", "?select=id,service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,entitlement_integration_verified,execution_enabled,metadata&status=eq.active&order=sort_order.asc,name.asc&limit=100");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const databaseItems = usingDatabase
      ? rows.rows.map((row) => {
          const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
          return {
            serviceKey: row.service_key,
            productKey: row.product_key,
            productType: row.product_type,
            name: row.name,
            summary: row.summary,
            customerOutcome: metadata.customerOutcome,
            dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies : [],
            safetyBoundary: metadata.safetyBoundary,
            tier: row.plan_floor === "free" ? "free" : "paid",
            planFloor: row.plan_floor,
            lifecycleStatus: row.lifecycle_status,
            route: row.route_path,
            entitlementIntegrationVerified: row.entitlement_integration_verified === true,
            executionEnabled: row.execution_enabled === true,
            deliverableType: row.product_type === "software_product" ? "Software product capability and governed workflow" : "Done-for-you service",
            priceNote: row.price_note || "Scoped after intake review.",
            sortOrder: Number(row.sort_order || 100)
          };
        })
      : [];
    const mergedCatalog = new Map();
    for (const item of DEFAULT_SERVICE_CATALOG) {
      mergedCatalog.set(\`\${item.productKey}:\${String(item.serviceKey || item.name).toLowerCase()}\`, item);
    }
    for (const item of databaseItems) {
      const key = \`\${item.productKey}:\${String(item.serviceKey || item.name).toLowerCase()}\`;
      mergedCatalog.set(key, { ...(mergedCatalog.get(key) || {}), ...item });
    }
    const items = [...mergedCatalog.values()].sort((left, right) => Number(left.sortOrder || 100) - Number(right.sortOrder || 100) || left.name.localeCompare(right.name));`;
  if (source.includes(oldLoad)) source = source.replace(oldLoad, newLoad);
  requireAnchor(source, "entitlement_integration_verified", "catalog entitlement columns");

  const oldCard = `      return actionCard(item.name, catalogCardBody(item), [
        linkAction("/requests", "Request this service"),
        product ? linkAction(\`/\${product.slug}\`, product.name) : linkAction("/start", "Start")
      ]);`;
  const newCard = `      return actionCard(item.name, catalogCardBody(item), catalogActions(item, product));`;
  if (source.includes(oldCard)) source = source.replace(oldCard, newCard);
  requireAnchor(source, "catalogActions(item, product)", "shared catalog actions");

  const oldProductCatalog = `        const rows = await safeListTable("service_catalog_items", \`?select=id,product_key,name,summary,price_note,status&status=eq.active&product_key=eq.\${encodeURIComponent(product.productKey)}&order=name.asc&limit=50\`);
        const usingDatabase = rows.ok && rows.rows.length > 0;
        const items = usingDatabase
          ? rows.rows.map((row) => ({ name: row.name, summary: row.summary, tier: "paid", priceNote: row.price_note || "Scoped after intake review." }))
          : DEFAULT_SERVICE_CATALOG.filter((item) => item.productKey === product.productKey);
        const sections = items.map((item) => actionCard(item.name, catalogCardBody(item), [linkAction("/requests", "Request this service")]));`;
  const newProductCatalog = `        const rows = await safeListTable("service_catalog_items", \`?select=id,service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,entitlement_integration_verified,execution_enabled,metadata&status=eq.active&product_key=eq.\${encodeURIComponent(product.productKey)}&order=sort_order.asc,name.asc&limit=100\`);
        const usingDatabase = rows.ok && rows.rows.length > 0;
        const productCatalogItems = new Map();
        for (const item of DEFAULT_SERVICE_CATALOG.filter((entry) => entry.productKey === product.productKey)) {
          productCatalogItems.set(String(item.serviceKey || item.name).toLowerCase(), item);
        }
        if (usingDatabase) {
          for (const row of rows.rows) {
            const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
            const item = {
              serviceKey: row.service_key,
              productKey: row.product_key,
              productType: row.product_type,
              name: row.name,
              summary: row.summary,
              customerOutcome: metadata.customerOutcome,
              tier: row.plan_floor === "free" ? "free" : "paid",
              planFloor: row.plan_floor,
              lifecycleStatus: row.lifecycle_status,
              route: row.route_path,
              entitlementIntegrationVerified: row.entitlement_integration_verified === true,
              executionEnabled: row.execution_enabled === true,
              deliverableType: row.product_type === "software_product" ? "Software product capability and governed workflow" : "Done-for-you service",
              priceNote: row.price_note || "Scoped after intake review.",
              sortOrder: Number(row.sort_order || 100)
            };
            const key = String(item.serviceKey || item.name).toLowerCase();
            productCatalogItems.set(key, { ...(productCatalogItems.get(key) || {}), ...item });
          }
        }
        const items = [...productCatalogItems.values()].sort((left, right) => Number(left.sortOrder || 100) - Number(right.sortOrder || 100) || left.name.localeCompare(right.name));
        const sections = items.map((item) => actionCard(item.name, catalogCardBody(item), catalogActions(item, product)));`;
  if (source.includes(oldProductCatalog)) source = source.replace(oldProductCatalog, newProductCatalog);
  requireAnchor(source, "productCatalogItems", "product catalog merge");

  source = source.replace('title: "Service catalog",', 'title: "Product and service catalog",');
  source = source.replace('heading: "Service catalog",', 'heading: "Product and service catalog",');
  source = source.replace(
    'body: "Done-for-you services across Business Builder, Creator Studio, and Growth Studio. Submit a request and track it from your dashboard.",',
    'body: "Published SONARA products, governed capabilities, and done-for-you services across the parent platform, Business Builder, Creator Studio, and Growth Studio. Availability and execution labels distinguish usable workflows from validation, entitlement, and setup boundaries.",'
  );
  source = source.replace(
    'body: `Done-for-you ${product.name} services. Submit a request and track it with a reference ID.`,',
    'body: `Published ${product.name} products and services. Direct execution remains unavailable until lifecycle and entitlement verification pass.`, '
  );

  write(file, source);
}

function patchSafeListTimeout() {
  const file = root("server.js");
  let source = read(file);
  const before = `async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  const response = await fetch(\`\${config.url}/rest/v1/\${table}\${query}\`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, rows: [] };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}`;
  const after = `async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  const timeoutMs = process.env.NODE_ENV === "test" ? 100 : 1200;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetch(\`\${config.url}/rest/v1/\${table}\${query}\`, {
      headers: supabaseHeaders(config),
      signal: controller.signal
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } finally {
    clearTimeout(timeout);
  }
}`;
  if (source.includes(before)) source = source.replace(before, after);
  requireAnchor(source, 'const timeoutMs = process.env.NODE_ENV === "test" ? 100 : 1200;', "safe catalog list timeout");
  write(file, source);
}

function patchEcosystemManifest() {
  const file = root("lib", "sonara-ecosystem-manifest.cjs");
  let source = read(file);
  const requireLine = 'const { getRecommendedProductCatalog } = require("./sonara-recommended-product-catalog.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const { getPublicAIIntegrationCatalog } = require("./sonara-ai-integration-registry.cjs");';
    requireAnchor(source, anchor, "ecosystem catalog require");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }
  if (!source.includes("recommendedProductCatalog: getRecommendedProductCatalog()")) {
    const anchor = "  adminControlPlane: {";
    requireAnchor(source, anchor, "ecosystem catalog insertion");
    source = source.replace(anchor, `  recommendedProductCatalog: getRecommendedProductCatalog(),\n${anchor}`);
  }
  write(file, source);
}

function root(...parts) {
  return path.join(process.cwd(), ...parts);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function requireAnchor(source, anchor, label) {
  if (!source.includes(anchor)) throw new Error(`Missing ${label} anchor: ${anchor}`);
}
