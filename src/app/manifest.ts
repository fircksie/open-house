import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Open House · US Open",
    short_name: "Open House",
    description: "A family US Open companion.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ef",
    theme_color: "#10213c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
