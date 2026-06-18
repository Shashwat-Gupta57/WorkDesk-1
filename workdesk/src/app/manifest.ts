import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkDesk",
    short_name: "WorkDesk",
    description: "The knowledge archive of Flex Studios.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0D1117",
    theme_color: "#0D1117",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
