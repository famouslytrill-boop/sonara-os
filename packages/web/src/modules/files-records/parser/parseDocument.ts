import type { ParseRequest, ParseResult } from "./contracts.ts";
export function parseDocument(request: ParseRequest): ParseResult {
  if (!request.permissionGranted)
    return {
      markdown: "",
      metadata: {},
      confidence: 0,
      warnings: ["permission_required"],
      license_warning: "provider_license_review_required",
      limitations: ["not_processed"]
    };
  return {
    markdown: "# Parsed document",
    metadata: { file_id: request.file_id, organization_id: request.organization_id },
    confidence: 0.5,
    warnings: ["stub_parser"],
    license_warning: "provider_license_review_required",
    limitations: ["external parsers disabled by default"]
  };
}
