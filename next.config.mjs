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
