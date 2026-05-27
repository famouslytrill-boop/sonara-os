import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/music",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/tableops",
        destination: "/business-builder",
        permanent: true,
      },
      {
        source: "/alertos",
        destination: "/growth-studio",
        permanent: true,
      },
      {
        source: "/civicsignal",
        destination: "/growth-studio",
        permanent: true,
      },
      {
        source: "/trackfoundry/:path*",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/lineready/:path*",
        destination: "/business-builder",
        permanent: true,
      },
      {
        source: "/noticegrid/:path*",
        destination: "/growth-studio",
        permanent: true,
      },
      {
        source: "/signal-os/:path*",
        destination: "/app",
        permanent: true,
      },
      {
        source: "/create",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/library",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/export",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/vault",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/records",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/engine",
        destination: "/creator-studio",
        permanent: true,
      },
      {
        source: "/exchange",
        destination: "/growth-studio",
        permanent: true,
      },
      {
        source: "/labs",
        destination: "/trust",
        permanent: true,
      },
      {
        source: "/tutorial",
        destination: "/onboarding",
        permanent: true,
      },
      {
        source: "/store",
        destination: "/pricing",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
