import type { NextConfig } from "next";

<<<<<<< HEAD
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://*.supabase.co",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
=======
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "x-forwarded-proto",
            value: "http",
          },
        ],
        destination: "https://sonaraindustries.com/:path*",
        permanent: true,
      },
    ];
  },
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
<<<<<<< HEAD
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
=======
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
<<<<<<< HEAD
=======
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
<<<<<<< HEAD
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), bluetooth=()",
=======
            value: "camera=(), microphone=(), geolocation=()",
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
          },
        ],
      },
    ];
  },
};

export default nextConfig;
