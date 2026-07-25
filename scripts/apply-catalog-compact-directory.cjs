"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "routes", "sonara-service-lifecycle-routes.cjs");
let source = fs.readFileSync(file, "utf8");

const helperMarker = "function catalogDirectorySections(items, resolveProduct)";
if (!source.includes(helperMarker)) {
  const anchor = `function catalogActions(item, product) {
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
  if (!source.includes(anchor)) throw new Error("Catalog action helper anchor is missing");
  const helper = `function catalogDirectorySections(items, resolveProduct) {
  const groups = new Map();
  for (const item of items) {
    const product = resolveProduct(item);
    const groupName = product?.name || (item.productKey === "sonara_industries" ? "SONARA Industries" : displayStatus(item.productKey || "Services"));
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push({ item, product });
  }
  return [...groups.entries()].map(([groupName, entries]) => {
    const rows = entries.map(({ item, product }) => {
      const actions = catalogActions(item, product).join("");
      return \`<article class="catalog-row"><div class="catalog-row-copy"><h3>\${escapeHtml(item.name)}</h3><p>\${escapeHtml(catalogCardBody(item))}</p></div><div class="actions">\${actions}</div></article>\`;
    }).join("");
    return \`<section class="card catalog-directory"><div class="catalog-directory-heading"><h2>\${escapeHtml(groupName)}</h2><p>\${entries.length} published product\${entries.length === 1 ? "" : "s"}</p></div><div class="catalog-list">\${rows}</div></section>\`;
  });
}`;
  source = source.replace(anchor, `${anchor}\n\n${helper}`);
}

const sharedBefore = `    const sections = items.map((item) => {
      const product = productByKey(item.productKey);
      return actionCard(item.name, catalogCardBody(item), catalogActions(item, product));
    });`;
const sharedAfter = `    const sections = catalogDirectorySections(items, (item) => productByKey(item.productKey));`;
if (source.includes(sharedBefore)) source = source.replace(sharedBefore, sharedAfter);

const productBefore = `        const sections = items.map((item) => actionCard(item.name, catalogCardBody(item), catalogActions(item, product)));`;
const productAfter = `        const sections = catalogDirectorySections(items, () => product);`;
if (source.includes(productBefore)) source = source.replace(productBefore, productAfter);

for (const marker of [
  helperMarker,
  "const sections = catalogDirectorySections(items, (item) => productByKey(item.productKey));",
  "const sections = catalogDirectorySections(items, () => product);"
]) {
  if (!source.includes(marker)) throw new Error(`Compact catalog marker is missing: ${marker}`);
}

fs.writeFileSync(file, source);
console.log("SONARA compact catalog directory applied");
