"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "routes", "sonara-service-lifecycle-routes.cjs");
let source = fs.readFileSync(file, "utf8");

const moduleBlock = `function catalogActions(item, product) {
  const reason = catalogAccessReason(item);
  const canOpen = reason === "open";
  const requestLabel = reason === "awaiting_review"
    ? "Ask about this one"
    : reason === "awaiting_paid_access"
      ? "Ask us to open access"
      : "Request this service";
  const actions = [linkAction("/requests", requestLabel)];
  if (canOpen) {
    const detailPath = item.route || (product ? \`/\${product.slug}\` : "/start");
    actions.push(linkAction(detailPath, item.serviceKey && item.planFloor !== "free" ? "Open paid product" : product ? product.name : "Open product"));
  } else {
    actions.push(linkAction("/service-catalog", "See what is ready now"));
  }
  return actions;
}`;

const scopedBlock = moduleBlock
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n");

if (source.includes(`\n\n${moduleBlock}`)) {
  source = source.replace(`\n\n${moduleBlock}`, "");
} else if (source.includes(moduleBlock)) {
  source = source.replace(moduleBlock, "");
}

const anchor = "  function productByKey(productKey) {";
if (!source.includes(scopedBlock)) {
  if (!source.includes(anchor)) throw new Error("Catalog helper factory anchor is missing");
  source = source.replace(anchor, `${scopedBlock}\n\n${anchor}`);
}

if (source.includes("\nfunction catalogActions(item, product)")) {
  throw new Error("Catalog actions remain at module scope");
}
if (!source.includes("  function catalogActions(item, product)")) {
  throw new Error("Catalog actions were not inserted into the route factory");
}

fs.writeFileSync(file, source);
console.log("SONARA catalog helper scope aligned");
