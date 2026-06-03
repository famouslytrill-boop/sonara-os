export interface ParseRequest {
  organization_id: string;
  file_id: string;
  permissionGranted: boolean;
  provider: string;
}
export interface ParseResult {
  markdown: string;
  metadata: Record<string, string>;
  confidence: number;
  warnings: string[];
  license_warning: string;
  limitations: string[];
}
