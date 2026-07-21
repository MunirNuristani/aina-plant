import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "aina — plant dashboard",
    short_name: "aina",
    description: "ESP32-based plant monitoring, data analytics, and AI recommendation platform",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2e9",
    theme_color: "#173f35",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
