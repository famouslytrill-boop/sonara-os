export type ApiRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiValidationIssue = Readonly<{
  id: string;
  message: string;
}>;

export type ApiRequestValidationInput = Readonly<{
  method: string;
  allowedMethods: readonly ApiRequestMethod[];
  rawBody?: string;
  parsedBody?: unknown;
  contentType?: string;
  maxBodyBytes?: number;
  requireJson?: boolean;
}>;

export type ApiRequestValidationResult = Readonly<{
  ok: boolean;
  status: "accepted" | "blocked";
  issues: readonly ApiValidationIssue[];
}>;

export type SetupModeApiResponse = Readonly<{
  ok: false;
  status: "setup_mode";
  reason: string;
}>;

const defaultMaxBodyBytes = 64 * 1024;

export function validateApiRequestContract(
  input: ApiRequestValidationInput
): ApiRequestValidationResult {
  const issues: ApiValidationIssue[] = [];
  const method = input.method.toUpperCase();
  const maxBodyBytes = input.maxBodyBytes ?? defaultMaxBodyBytes;

  if (!input.allowedMethods.includes(method as ApiRequestMethod)) {
    issues.push({
      id: "method-not-allowed",
      message: `${method} is not allowed for this API contract.`
    });
  }

  if (input.rawBody && byteLength(input.rawBody) > maxBodyBytes) {
    issues.push({
      id: "body-too-large",
      message: `Request body exceeds ${maxBodyBytes} bytes.`
    });
  }

  if (
    input.requireJson &&
    input.rawBody &&
    !(input.contentType ?? "").toLowerCase().includes("application/json")
  ) {
    issues.push({
      id: "json-content-type-required",
      message: "Mutating JSON endpoints must require application/json content type."
    });
  }

  if (input.parsedBody !== undefined && !isJsonCompatible(input.parsedBody)) {
    issues.push({
      id: "invalid-json-shape",
      message: "Parsed body must be JSON-compatible data."
    });
  }

  return Object.freeze({
    ok: issues.length === 0,
    status: issues.length === 0 ? "accepted" : "blocked",
    issues: Object.freeze(issues)
  });
}

export function createSetupModeApiResponse(reason: string): SetupModeApiResponse {
  return Object.freeze({
    ok: false,
    status: "setup_mode",
    reason
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isJsonCompatible(value: unknown, depth = 0): boolean {
  if (depth > 16) {
    return false;
  }
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return Number.isFinite(value as number) || valueType !== "number";
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonCompatible(item, depth + 1));
  }
  if (valueType === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((item) =>
      isJsonCompatible(item, depth + 1)
    );
  }
  return false;
}
