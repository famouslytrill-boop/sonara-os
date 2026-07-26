"use strict";

const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(__dirname, "..", "openapi", "sonara.yaml");
let source = fs.readFileSync(filePath, "utf8");

if (!source.includes("  /api/prompt-library/collections/{id}/items:")) {
  const marker = "  /api/prompt-library/connections:";
  if (!source.includes(marker)) throw new Error("Prompt Library OpenAPI collection-item marker not found");

  const block = `  /api/prompt-library/collections/{id}/items:
    post:
      operationId: addPromptTemplateToCollection
      tags: [Prompt Library]
      summary: Add an organization prompt template to a collection in a product workspace.
      security: [{ bearerAuth: [] }]
      parameters:
        - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [productArea, templateId]
              properties:
                productArea: { type: string, enum: [business_builder, creator_studio, growth_studio] }
                templateId: { type: string, format: uuid }
                order: { type: integer, minimum: 0, maximum: 999 }
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "503": { $ref: "#/components/responses/SetupRequired" }
`;

  source = source.replace(marker, `${block}${marker}`);
}

fs.writeFileSync(filePath, source);
console.log("Prompt Library collection-item OpenAPI contract applied");
