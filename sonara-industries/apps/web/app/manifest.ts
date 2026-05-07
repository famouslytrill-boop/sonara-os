import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SONARA Industries",
    short_name: "SONARA",
    description: "Software infrastructure for creator systems, restaurant operations, and verified local information.",
    start_url: "/",
    display: "standalone",
    background_color: "#080A12",
    theme_color: "#7C3AED",
    icons: [
      { src: "/brand/sonara/mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      {
        name: "Open TrackFoundry",
        short_name: "TrackFoundry",
        description: "Open music creation and release-readiness software.",
        url: "/trackfoundry",
        icons: [{ src: "/brand/trackfoundry/mark.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Open LineReady",
        short_name: "LineReady",
        description: "Open restaurant operations and labor-control software.",
        url: "/lineready",
        icons: [{ src: "/brand/lineready/mark.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Open NoticeGrid",
        short_name: "NoticeGrid",
        description: "Open verified local information and public notices.",
        url: "/noticegrid",
        icons: [{ src: "/brand/noticegrid/mark.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
