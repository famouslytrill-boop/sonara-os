import fs from "node:fs";
import path from "node:path";

export const securityHeaders = Object.freeze([
  Object.freeze({
    name: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://checkout.stripe.com"
    ].join("; ")
  }),
  Object.freeze({ name: "X-Frame-Options", value: "DENY" }),
  Object.freeze({ name: "X-Content-Type-Options", value: "nosniff" }),
  Object.freeze({ name: "Referrer-Policy", value: "strict-origin-when-cross-origin" }),
  Object.freeze({
    name: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "serial=()"
    ].join(", ")
  })
]);

export const securityHeaderRecord = Object.freeze(
  Object.fromEntries(securityHeaders.map((header) => [header.name, header.value]))
);

export function createHeadersFile() {
  return ["/*", ...securityHeaders.map((header) => `  ${header.name}: ${header.value}`), ""].join(
    "\n"
  );
}

export function writeSecurityHeadersFile(distDir) {
  fs.writeFileSync(path.join(distDir, "_headers"), createHeadersFile(), "utf8");
}
