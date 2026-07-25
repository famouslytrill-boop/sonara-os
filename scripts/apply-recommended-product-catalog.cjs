"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServiceCatalogRoute();
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

  if (!source.includes('productKey: "sonara_industries"')) {
    const anchor = "const PRODUCTS = [";
    requireAnchor(source, anchor, "parent catalog product");
    source = source.replace(anchor, `${anchor}\n  { slug: "products", productKey: "sonara_industries", name: "SONARA Industries" },`);
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
  if (item.deliverableType) parts.push(\`Type: \${item.deliverableType}.\`);
  if (item.lifecycleStatus) parts.push(\`Availability: \${String(item.lifecycleStatus).replace(/_/g, " ")}.\`);
  if (item.planFloor) parts.push(\`Plan floor: \${item.planFloor}.\`);
  else parts.push(\`Access: \${item.tier === "free" ? "Free tool" : "Paid service"}.\`);
  if (item.priceNote) parts.push(\`Pricing: \${item.priceNote}\`);
  return parts.join(" ");
}`;
  if (source.includes(oldCardBody)) source = source.replace(oldCardBody, newCardBody);
  requireAnchor(source, "Availability:", "catalog availability label");

  const oldLoad = `    const rows = await safeListTable("service_catalog_items", "?select=id,product_key,name,summary,price_note,status&status=eq.active&order=name.asc&limit=50");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const items = usingDatabase
      ? rows.rows.map((row) => ({ productKey: row.product_key, name: row.name, summary: row.summary, tier: "paid", priceNote: row.price_note || "Scoped after intake review." }))
      : DEFAULT_SERVICE_CATALOG;`;
  const newLoad = `    const rows = await safeListTable("service_catalog_items", "?select=id,service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,metadata&status=eq.active&order=sort_order.asc,name.asc&limit=100");
    const usingDatabase = rows.ok && rows.rows.length > 0;
    const databaseItems = usingDatabase
      ? rows.rows.map((row) => {
          const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
          return {
            serviceKey: row.service_key,
            productKey: row.product_key,
            name: row.name,
            summary: row.summary,
            customerOutcome: metadata.customerOutcome,
            dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies : [],
            safetyBoundary: metadata.safetyBoundary,
            tier: row.plan_floor === "free" ? "free" : "paid",
            planFloor: row.plan_floor,
            lifecycleStatus: row.lifecycle_status,
            route: row.route_path,
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
  requireAnchor(source, "mergedCatalog", "catalog merge");

  const oldCard = `      return actionCard(item.name, catalogCardBody(item), [
        linkAction("/requests", "Request this service"),
        product ? linkAction(\`/\${product.slug}\`, product.name) : linkAction("/start", "Start")
      ]);`;
  const newCard = `      const detailPath = item.route || (product ? \`/\${product.slug}\` : "/start");
      return actionCard(item.name, catalogCardBody(item), [
        linkAction("/requests", "Request or discuss"),
        linkAction(detailPath, product ? product.name : "Open product")
      ]);`;
  if (source.includes(oldCard)) source = source.replace(oldCard, newCard);
  requireAnchor(source, 'linkAction("/requests", "Request or discuss")', "catalog action");

  source = source.replace('title: "Service catalog",', 'title: "Product and service catalog",');
  source = source.replace('heading: "Service catalog",', 'heading: "Product and service catalog",');
  source = source.replace(
    'body: "Done-for-you services across Business Builder, Creator Studio, and Growth Studio. Submit a request and track it from your dashboard.",',
    'body: "Published SONARA products, governed capabilities, and done-for-you services across the parent platform, Business Builder, Creator Studio, and Growth Studio. Availability labels distinguish active, beta, validation-required, and planned work."'
  );

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
