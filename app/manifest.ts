import type { MetadataRoute } from "next";

/** Bookmark identity; no service worker or offline functionality is implied. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ПОТОЛКОВО — потолки и освещение",
    short_name: "ПОТОЛКОВО",
    lang: "ru",
    start_url: "/",
    display: "browser",
    background_color: "#f6f5ef",
    theme_color: "#173c36",
    icons: [192, 512].map(size => ({ src: `/brand/v7/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
