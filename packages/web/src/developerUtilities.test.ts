import { describe, expect, it } from "vitest";
import {
  decodeBase64,
  decodeJwt,
  decodeUrl,
  encodeBase64,
  encodeUrl,
  formatJson,
  generateSlug,
  generateUuid,
  redactWebhookPayload
} from "./lib/developer-utilities/index.ts";

describe("Developer Utility Center helpers", () => {
  it("formats JSON and reports invalid JSON", () => {
    expect(formatJson('{"name":"SONARA","active":true}')).toEqual({
      ok: true,
      output: '{\n  "name": "SONARA",\n  "active": true\n}'
    });
    expect(formatJson("{bad json").ok).toBe(false);
  });

  it("encodes and decodes Base64 and URL values", () => {
    const encodedBase64 = encodeBase64("Launch check");
    const encodedUrl = encodeUrl("proof profile / launch");

    expect(encodedBase64.ok).toBe(true);
    expect(decodeBase64(encodedBase64.output)).toEqual({ ok: true, output: "Launch check" });
    expect(encodedUrl.output).toBe("proof%20profile%20%2F%20launch");
    expect(decodeUrl(encodedUrl.output)).toEqual({ ok: true, output: "proof profile / launch" });
  });

  it("generates UUIDs and slugs", () => {
    expect(generateUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(generateSlug("  Proof Profile Launch!  ")).toBe("proof-profile-launch");
  });

  it("decodes JWT payloads without verification", () => {
    const token = `${base64Url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${base64Url(
      JSON.stringify({ sub: "user_123", role: "viewer" })
    )}.signature`;
    const decoded = decodeJwt(token);

    expect(decoded.ok).toBe(true);
    expect(decoded.signaturePresent).toBe(true);
    expect(decoded.warning).toMatch(/not verified/i);
    expect(decoded.payload).toEqual({ sub: "user_123", role: "viewer" });
  });

  it("redacts webhook secrets before display", () => {
    const secretValue = `sk_live_${"a".repeat(24)}`;
    const result = redactWebhookPayload(
      JSON.stringify({
        id: "evt_123",
        authorization: "Bearer hidden",
        data: {
          api_key: secretValue,
          nested: {
            webhook_secret: "secret-value"
          }
        }
      })
    );

    expect(result.ok).toBe(true);
    expect(result.redactionCount).toBe(3);
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain(secretValue);
  });
});

function base64Url(value: string): string {
  return encodeBase64(value).output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
