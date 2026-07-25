"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "routes", "sonara-service-lifecycle-routes.cjs");
let source = fs.readFileSync(file, "utf8");

const helperMarker = "  function catalogDirectorySections(items, resolveProduct)";
if (!source.includes(helperMarker)) {
  const anchor = "  function productByKey(productKey) {";
  if (!source.includes(anchor)) throw new Error("Compact catalog factory anchor is missing");
  const helper = `  function catalogDirectorySections(items, resolveProduct) {
    const groups = new Map();
    for (const item of items) {
      let product = null;
      try {
        product = resolveProduct(item) || null;
      } catch (_) {
        product = null;
      }
      const groupName = product?.name || (item?.productKey === "sonara_industries" ? "SONARA Industries" : displayStatus(item?.productKey || "Services"));
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push({ item: item || {}, product });
    }
    return [...groups.entries()].map(([groupName, entries]) => {
      const rows = entries.map(({ item, product }) => {
        try {
          const actions = catalogActions(item, product).join("");
          return \`<article class="catalog-row"><div class="catalog-row-copy"><h3>\${escapeHtml(item.name || "Catalog item")}</h3><p>\${escapeHtml(catalogCardBody(item))}</p></div><div class="actions">\${actions}</div></article>\`;
        } catch (_) {
          const fallbackName = escapeHtml(item?.name || "Catalog item");
          const fallbackSummary = escapeHtml(item?.summary || "This catalog entry needs review before it can be opened.");
          return \`<article class="catalog-row"><div class="catalog-row-copy"><h3>\${fallbackName}</h3><p>\${fallbackSummary}</p></div><div class="actions">\${linkAction("/requests", "Request catalog review")}</div></article>\`;
        }
      }).join("");
      return \`<section class="card catalog-directory"><div class="catalog-directory-heading"><h2>\${escapeHtml(groupName)}</h2><p>\${entries.length} published product\${entries.length === 1 ? "" : "s"}</p></div><div class="catalog-list">\${rows}</div></section>\`;
    });
  }

`;
  source = source.replace(anchor, `${helper}${anchor}`);
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
  "Request catalog review",
  "const sections = catalogDirectorySections(items, (item) => productByKey(item.productKey));",
  "const sections = catalogDirectorySections(items, () => product);"
]) {
  if (!source.includes(marker)) throw new Error(`Compact catalog marker is missing: ${marker}`);
}
if (source.includes("\nfunction catalogDirectorySections(items, resolveProduct)")) {
  throw new Error("Compact catalog helper remains at module scope");
}

fs.writeFileSync(file, source);
console.log("SONARA compact catalog directory applied");
