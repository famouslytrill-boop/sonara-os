"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "routes", "sonara-service-lifecycle-routes.cjs");
let source = fs.readFileSync(file, "utf8");

const helperMarker = "  function registerCatalogRoute(route, handler)";
if (!source.includes(helperMarker)) {
  const anchor = "  function productByKey(productKey) {";
  if (!source.includes(anchor)) throw new Error("Catalog route factory anchor is missing");
  const helper = `  function registerCatalogRoute(route, handler) {
    app.get(route, (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch((error) => {
        if (process.env.NODE_ENV === "test") {
          console.error("SONARA catalog route failure", route, error?.stack || error?.message || error);
        }
        if (res.headersSent) return next(error);
        return res.status(503).type("html").send(
          layout({
            title: "Catalog temporarily unavailable",
            eyebrow: "Catalog boundary",
            heading: "Catalog temporarily unavailable",
            body: "The catalog could not be rendered safely. No purchase or access state was changed.",
            sections: [brandCard("Setup required", "Use the request center while catalog rendering is restored.")],
            actions: [linkAction("/requests", "Request assistance"), linkAction("/", "Home")]
          })
        );
      });
    });
  }

`;
  source = source.replace(anchor, `${helper}${anchor}`);
}

source = source.replace(
  '  app.get("/service-catalog", async (req, res) => {',
  '  registerCatalogRoute("/service-catalog", async (req, res) => {'
);
source = source.replace(
  '      app.get(`/${product.slug}/catalog`, async (req, res) => {',
  '      registerCatalogRoute(`/${product.slug}/catalog`, async (req, res) => {'
);

for (const marker of [
  helperMarker,
  'registerCatalogRoute("/service-catalog", async (req, res) => {',
  'registerCatalogRoute(`/${product.slug}/catalog`, async (req, res) => {'
]) {
  if (!source.includes(marker)) throw new Error(`Catalog route boundary marker is missing: ${marker}`);
}
if (source.includes("\nfunction registerCatalogRoute(route, handler)")) {
  throw new Error("Catalog route helper remains at module scope");
}

fs.writeFileSync(file, source);
console.log("SONARA catalog async route boundary applied");
