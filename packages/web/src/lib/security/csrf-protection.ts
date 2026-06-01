import type { ApiRequestMethod } from "./api-validation.ts";

export type CsrfValidationResult = Readonly<{
  ok: boolean;
  status: "not_required" | "ready" | "setup_mode" | "blocked";
  message: string;
}>;

const mutatingMethods = Object.freeze([
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
] satisfies readonly ApiRequestMethod[]);

export function requiresCsrfProtection(method: string): boolean {
  return (mutatingMethods as readonly string[]).includes(method.toUpperCase());
}

export function validateCsrfRequirement({
  method,
  token,
  expectedToken
}: {
  method: string;
  token?: string;
  expectedToken?: string;
}): CsrfValidationResult {
  if (!requiresCsrfProtection(method)) {
    return Object.freeze({
      ok: true,
      status: "not_required",
      message: "Read-only requests do not require CSRF token validation."
    });
  }

  if (!expectedToken) {
    return Object.freeze({
      ok: false,
      status: "setup_mode",
      message: "Mutating routes require CSRF validation when a server action exists."
    });
  }

  const valid = Boolean(token) && token === expectedToken;
  return Object.freeze({
    ok: valid,
    status: valid ? "ready" : "blocked",
    message: valid ? "CSRF token matched." : "CSRF token is missing or invalid."
  });
}
