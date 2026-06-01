export type FileUploadSafetyInput = Readonly<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}>;

export type FileUploadSafetyResult = Readonly<{
  ok: boolean;
  status: "allowed_for_future_route" | "blocked" | "setup_mode";
  issues: readonly string[];
}>;

export const fileUploadSafetyPolicy = Object.freeze({
  storageEnabled: false,
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: Object.freeze([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain"
  ]),
  blockedExtensions: Object.freeze([
    ".bat",
    ".cmd",
    ".com",
    ".exe",
    ".html",
    ".js",
    ".mjs",
    ".msi",
    ".php",
    ".ps1",
    ".sh",
    ".svg"
  ])
});

export function evaluateFileUploadSafety(input: FileUploadSafetyInput): FileUploadSafetyResult {
  const issues: string[] = [];
  const extension = getExtension(input.fileName);

  if (!fileUploadSafetyPolicy.storageEnabled) {
    issues.push("File storage is not enabled in the MVP static shell.");
  }
  if (fileUploadSafetyPolicy.blockedExtensions.includes(extension)) {
    issues.push(`${extension} files are blocked.`);
  }
  if (!fileUploadSafetyPolicy.allowedMimeTypes.includes(input.mimeType)) {
    issues.push(`${input.mimeType} is not in the allowed MIME list.`);
  }
  if (input.sizeBytes > fileUploadSafetyPolicy.maxSizeBytes) {
    issues.push("File exceeds the maximum placeholder upload size.");
  }

  return Object.freeze({
    ok: issues.length === 0,
    status: issues.length === 0 ? "allowed_for_future_route" : "blocked",
    issues: Object.freeze(issues)
  });
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
}
