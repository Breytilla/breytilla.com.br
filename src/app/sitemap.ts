import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://breytilla.com.br",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://breytilla.com.br/privacidade",
      lastModified: new Date("2026-08-20"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
