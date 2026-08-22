import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/server/admin/posts";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();
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
    {
      url: "https://breytilla.com.br/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts.map((post) => ({
      url: `https://breytilla.com.br/blog/${encodeURIComponent(post.slug)}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
