import type { MetadataRoute } from "next";

/**
 * Generates /robots.txt via the Next.js App Router metadata API.
 * Allows all crawlers on public routes and disallows noisy API paths.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://goonforge.xyz/sitemap.xml",
    host: "https://goonforge.xyz",
  };
}
