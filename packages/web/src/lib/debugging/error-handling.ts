export type ClientSafeError = Readonly<{
  title: string;
  message: string;
  referenceId: string;
}>;

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "setup_required"
  | "internal_error";

export type ApiErrorResponse = Readonly<{
  ok: false;
  status: number;
  error: Readonly<{
    code: ApiErrorCode;
    message: string;
    requestId: string;
  }>;
}>;

const safeErrorMessage =
  "Something went wrong while loading this page. The app shell is still available.";

export function createClientSafeError(error: unknown, referencePrefix = "sonara"): ClientSafeError {
  void error;
  const referenceId = createErrorReference(referencePrefix);
  return Object.freeze({
    title: "This page could not load.",
    message: safeErrorMessage,
    referenceId
  });
}

export function createApiErrorResponse({
  code,
  message,
  status,
  requestId = createErrorReference("api")
}: {
  code: ApiErrorCode;
  message: string;
  status: number;
  requestId?: string;
}): ApiErrorResponse {
  return Object.freeze({
    ok: false,
    status,
    error: Object.freeze({
      code,
      message: sanitizeClientMessage(message),
      requestId
    })
  });
}

export function sanitizeClientMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return safeErrorMessage;
  }
  if (containsSensitiveErrorDetail(trimmed)) {
    return safeErrorMessage;
  }
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

export function containsSensitiveErrorDetail(message: string): boolean {
  return /(stack|trace|secret|token|password|service.?role|api.?key|webhook|database_url|sk_live)/i.test(
    message
  );
}

function createErrorReference(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}
