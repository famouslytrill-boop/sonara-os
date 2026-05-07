import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/music",
        destination: "/trackfoundry",
        permanent: true,
      },
      {
        source: "/tableops",
        destination: "/lineready",
        permanent: true,
      },
      {
        source: "/alertos",
        destination: "/noticegrid",
        permanent: true,
      },
      {
        source: "/civicsignal",
        destination: "/noticegrid",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/trackfoundry/:path*",
        destination: "/music/:path*",
      },
      {
        source: "/lineready/:path*",
        destination: "/tableops/:path*",
      },
      {
        source: "/noticegrid/:path*",
        destination: "/civic/:path*",
      },
    ];
  },
};

export default nextConfig;
