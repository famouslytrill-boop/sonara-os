import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(dirname, ".."),
  },
  async redirects() {
    return [
      { source: "/trackfoundry/:path*", destination: "/creator-studio", permanent: true },
      { source: "/lineready/:path*", destination: "/business-builder", permanent: true },
      { source: "/noticegrid/:path*", destination: "/growth-studio", permanent: true },
      { source: "/sonara-one/:path*", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
