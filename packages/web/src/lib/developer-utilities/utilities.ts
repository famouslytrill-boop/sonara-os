export type UtilityResult = Readonly<{
  ok: boolean;
  output: string;
  error?: string;
}>;

export type JwtDecodeResult = Readonly<{
  ok: boolean;
  header: unknown | null;
  payload: unknown | null;
  signaturePresent: boolean;
  warning: string;
  error?: string;
}>;

export type RedactionResult = Readonly<{
  ok: boolean;
  output: string;
  redactionCount: number;
  error?: string;
}>;

const redactedValue = "[REDACTED]";
const jwtWarning = "Decoded only. Signature and claims are not verified.";
const sensitiveKeyPattern =
  /authorization|api[_-]?key|client[_-]?secret|password|secret|service[_-]?role|signature|token/i;

export function formatJson(input: string): UtilityResult {
  try {
    return {
      ok: true,
      output: JSON.stringify(JSON.parse(input), null, 2)
    };
  } catch (error) {
    return {
      ok: false,
      output: "",
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}

export function encodeBase64(input: string): UtilityResult {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return { ok: true, output: btoa(binary) };
  } catch (error) {
    return {
      ok: false,
      output: "",
      error: error instanceof Error ? error.message : "Base64 encode failed"
    };
  }
}

export function decodeBase64(input: string): UtilityResult {
  try {
    const binary = atob(input.trim());
    const bytes = new Uint8Array([...binary].map((character) => character.charCodeAt(0)));
    return { ok: true, output: new TextDecoder().decode(bytes) };
  } catch (error) {
    return {
      ok: false,
      output: "",
      error: error instanceof Error ? error.message : "Base64 decode failed"
    };
  }
}

export function encodeUrl(input: string): UtilityResult {
  return { ok: true, output: encodeURIComponent(input) };
}

export function decodeUrl(input: string): UtilityResult {
  try {
    return { ok: true, output: decodeURIComponent(input) };
  } catch (error) {
    return {
      ok: false,
      output: "",
      error: error instanceof Error ? error.message : "URL decode failed"
    };
  }
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
    (
      Number(character) ^
      (Math.floor(Math.random() * 256) & (15 >> (Number(character) / 4)))
    ).toString(16)
  );
}

export function generateSlug(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

export function decodeJwt(token: string): JwtDecodeResult {
  const parts = token.trim().split(".");
  if (parts.length < 2) {
    return {
      ok: false,
      header: null,
      payload: null,
      signaturePresent: false,
      warning: jwtWarning,
      error: "JWT must include header and payload sections."
    };
  }
  try {
    return {
      ok: true,
      header: JSON.parse(decodeBase64Url(parts[0])),
      payload: JSON.parse(decodeBase64Url(parts[1])),
      signaturePresent: Boolean(parts[2]),
      warning: jwtWarning
    };
  } catch (error) {
    return {
      ok: false,
      header: null,
      payload: null,
      signaturePresent: Boolean(parts[2]),
      warning: jwtWarning,
      error: error instanceof Error ? error.message : "JWT decode failed"
    };
  }
}

export function redactWebhookPayload(input: string): RedactionResult {
  try {
    const parsed = JSON.parse(input) as unknown;
    const result = redactJsonValue(parsed);
    return {
      ok: true,
      output: JSON.stringify(result.value, null, 2),
      redactionCount: result.count
    };
  } catch {
    const result = redactPlainText(input);
    return {
      ok: true,
      output: result.output,
      redactionCount: result.count
    };
  }
}

function decodeBase64Url(input: string): string {
  const padded = `${input.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(
    (4 - (input.length % 4)) % 4
  )}`;
  const decoded = decodeBase64(padded);
  if (!decoded.ok) {
    throw new Error(decoded.error ?? "Base64url decode failed");
  }
  return decoded.output;
}

function redactJsonValue(value: unknown): { value: unknown; count: number } {
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const redacted = redactJsonValue(item);
      count += redacted.count;
      return redacted.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = redactedValue;
        count += 1;
        continue;
      }
      const redacted = redactJsonValue(child);
      output[key] = redacted.value;
      count += redacted.count;
    }
    return { value: output, count };
  }
  return { value, count: 0 };
}

function redactPlainText(input: string): { output: string; count: number } {
  let count = 0;
  const output = input
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/g, () => {
      count += 1;
      return `Bearer ${redactedValue}`;
    })
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9_=-]{12,}/g, () => {
      count += 1;
      return redactedValue;
    })
    .replace(
      /((?:api[_-]?key|client[_-]?secret|password|secret|service[_-]?role|signature|token)\s*[:=]\s*)("[^"]+"|'[^']+'|[^\s,]+)/gi,
      (_match, prefix: string) => {
        count += 1;
        return `${prefix}${redactedValue}`;
      }
    );
  return { output, count };
}
