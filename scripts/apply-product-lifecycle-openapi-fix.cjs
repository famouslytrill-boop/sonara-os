"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "openapi", "sonara.yaml");
let source = fs.readFileSync(file, "utf8");

const route = "  /api/product-lifecycle/initiatives/{initiativeId}/iterations:";
if (!source.includes(route)) {
  const anchor = "  /api/product-lifecycle/initiatives/{initiativeId}/feedback:";
  if (!source.includes(anchor)) throw new Error("Product lifecycle feedback OpenAPI anchor not found");
  const block = `  /api/product-lifecycle/initiatives/{initiativeId}/iterations:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: recordProductLifecycleIteration
      tags: [Product Lifecycle]
      summary: Record a goal-led iteration with dates, Definition of Done, review notes, and retrospective evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
`;
  source = source.replace(anchor, `${block}${anchor}`);
  fs.writeFileSync(file, source);
}

for (const marker of [
  "/api/product-lifecycle/initiatives/{initiativeId}/iterations:",
  "operationId: recordProductLifecycleIteration",
  "Definition of Done"
]) {
  if (!source.includes(marker)) throw new Error(`Product lifecycle OpenAPI marker missing: ${marker}`);
}

console.log("Product lifecycle iteration OpenAPI contract aligned");
