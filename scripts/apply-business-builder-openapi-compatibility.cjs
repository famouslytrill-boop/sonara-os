"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "openapi", "sonara.yaml");
let source = fs.readFileSync(file, "utf8");
const route = "  /api/business-builder/businesses/{businessId}/{resource}/{id}/archive:";
if (!source.includes(route)) {
  const marker = "components:";
  if (!source.includes(marker)) throw new Error("OpenAPI components marker not found");
  const block = `  /api/business-builder/businesses/{businessId}/{resource}/{id}/archive:
    parameters:
      - in: path
        name: businessId
        required: true
        schema: { type: string, format: uuid }
      - in: path
        name: resource
        required: true
        schema:
          type: string
          enum: [locations, channels, employees, services, customers, inventory, assets, orders, bookings, integrations, permissions]
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: archiveBusinessBuilderResourceRecordForm
      tags: [Business Builder]
      summary: Archive one organization- and business-scoped operating record from the customer interface.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
`;
  source = source.replace(marker, `${block}${marker}`);
  fs.writeFileSync(file, source);
}
console.log("Business Builder archive OpenAPI contract aligned");
