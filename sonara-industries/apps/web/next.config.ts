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
};

export default nextConfig;
