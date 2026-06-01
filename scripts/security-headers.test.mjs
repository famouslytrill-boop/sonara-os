import { describe, expect, it } from "vitest";
import { createHeadersFile, securityHeaderRecord, securityHeaders } from "./security-headers.mjs";

describe("security headers", () => {
  it("defines the required static hardening headers", () => {
    expect(securityHeaderRecord["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(securityHeaderRecord["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(securityHeaderRecord["Content-Security-Policy"]).toContain("base-uri 'self'");
    expect(securityHeaderRecord["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(securityHeaderRecord["X-Frame-Options"]).toBe("DENY");
    expect(securityHeaderRecord["X-Content-Type-Options"]).toBe("nosniff");
    expect(securityHeaderRecord["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(securityHeaderRecord["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders).toHaveLength(5);
  });

  it("generates a compatible static _headers artifact", () => {
    const headersFile = createHeadersFile();
    expect(headersFile).toContain("/*");
    expect(headersFile).toContain("Content-Security-Policy:");
    expect(headersFile).toContain("Permissions-Policy:");
  });
});
