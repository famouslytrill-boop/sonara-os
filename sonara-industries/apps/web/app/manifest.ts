import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SONARA Industries Operating Systems",
    short_name: "SONARA",
    description: "Parent platform for SoundOS, TableOS, and AlertOS.",
    start_url: "/",
    display: "standalone",
    background_color: "#070913",
    theme_color: "#22d3ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
