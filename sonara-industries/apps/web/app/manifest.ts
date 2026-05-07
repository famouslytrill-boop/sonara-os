import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SONARA Industries",
    short_name: "SONARA",
    description: "Independent systems. Shared infrastructure. Stronger markets.",
    start_url: "/",
    display: "standalone",
    background_color: "#070913",
    theme_color: "#070913",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Open TrackFoundry",
        short_name: "TrackFoundry",
        description: "Open music creation and release-readiness software.",
        url: "/trackfoundry",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Open LineReady",
        short_name: "LineReady",
        description: "Open restaurant operations and labor-control software.",
        url: "/lineready",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Open NoticeGrid",
        short_name: "NoticeGrid",
        description: "Open verified local information and public notices.",
        url: "/noticegrid",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
