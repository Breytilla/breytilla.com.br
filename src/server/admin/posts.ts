import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getDatabase } from "@/server/email/database";

export type PostStatus = "draft" | "published" | "archived";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  status: PostStatus;
  seo_title: string | null;
  seo_description: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  status: PostStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BlogPostSummary = Omit<BlogPost, "content">;

const optionalIdSchema = z.union([z.literal(""), z.uuid()]);

export const blogPostInputSchema = z.object({
  id: optionalIdSchema.default(""),
  version: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""),
  title: z.string().trim().min(4).max(140),
  slug: z
    .string()
    .trim()
    .max(160)
    .regex(/^(?:|[a-z0-9]+(?:-[a-z0-9]+)*)$/),
  excerpt: z.string().trim().min(20).max(320),
  content: z.string().trim().min(80).max(50_000),
  category: z.string().trim().min(2).max(60),
  status: z.enum(["draft", "published", "archived"]),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
});

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

function mapPost(row: PostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapPostSummary(row: PostRow): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function slugifyPostTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "");
}

export async function listPublishedPosts(): Promise<BlogPostSummary[]> {
  const rows = await getDatabase()<PostRow[]>`
    SELECT
      id,
      slug,
      title,
      excerpt,
      ''::text AS content,
      category,
      status,
      seo_title,
      seo_description,
      published_at,
      created_at,
      updated_at
    FROM blog_posts
    WHERE status = 'published'
      AND published_at <= now()
    ORDER BY published_at DESC, id DESC
  `;

  return rows.map(mapPostSummary);
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  const [row] = await getDatabase()<PostRow[]>`
    SELECT
      id,
      slug,
      title,
      excerpt,
      content,
      category,
      status,
      seo_title,
      seo_description,
      published_at,
      created_at,
      updated_at
    FROM blog_posts
    WHERE slug = ${slug}
      AND status = 'published'
      AND published_at <= now()
    LIMIT 1
  `;
  return row ? mapPost(row) : null;
}

export async function listAdminPosts(): Promise<BlogPostSummary[]> {
  const rows = await getDatabase()<PostRow[]>`
    SELECT
      id,
      slug,
      title,
      excerpt,
      ''::text AS content,
      category,
      status,
      seo_title,
      seo_description,
      published_at,
      created_at,
      updated_at
    FROM blog_posts
    ORDER BY updated_at DESC, id DESC
  `;
  return rows.map(mapPostSummary);
}

export async function getAdminPostById(id: string): Promise<BlogPost | null> {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const [row] = await getDatabase()<PostRow[]>`
    SELECT
      id,
      slug,
      title,
      excerpt,
      content,
      category,
      status,
      seo_title,
      seo_description,
      published_at,
      created_at,
      updated_at
    FROM blog_posts
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ? mapPost(row) : null;
}

export async function saveBlogPost(rawInput: BlogPostInput): Promise<{
  id: string;
  slug: string;
  status: PostStatus;
}> {
  const input = blogPostInputSchema.parse(rawInput);
  const id = input.id || randomUUID();
  const slug = input.slug || slugifyPostTitle(input.title);
  if (!slug) {
    throw new Error("POST_SLUG_INVALID");
  }

  return getDatabase().begin(async (transaction) => {
    let saved: { id: string; slug: string; status: PostStatus } | undefined;
    let auditAction: "post.created" | "post.updated";

    if (input.id) {
      if (!input.version) {
        throw new Error("POST_VERSION_REQUIRED");
      }
      [saved] = await transaction<
        { id: string; slug: string; status: PostStatus }[]
      >`
        UPDATE blog_posts
        SET
          slug = ${slug},
          title = ${input.title},
          excerpt = ${input.excerpt},
          content = ${input.content},
          category = ${input.category},
          status = ${input.status},
          seo_title = ${input.seoTitle || null},
          seo_description = ${input.seoDescription || null},
          published_at = CASE
            WHEN ${input.status} = 'published'
              THEN COALESCE(published_at, now())
            ELSE NULL
          END
        WHERE id = ${input.id}
          AND updated_at = ${new Date(input.version)}
        RETURNING id, slug, status
      `;
      if (!saved) {
        throw new Error("POST_VERSION_CONFLICT");
      }
      auditAction = "post.updated";
    } else {
      [saved] = await transaction<
        { id: string; slug: string; status: PostStatus }[]
      >`
        INSERT INTO blog_posts (
          id,
          slug,
          title,
          excerpt,
          content,
          category,
          status,
          seo_title,
          seo_description,
          published_at
        ) VALUES (
          ${id},
          ${slug},
          ${input.title},
          ${input.excerpt},
          ${input.content},
          ${input.category},
          ${input.status},
          ${input.seoTitle || null},
          ${input.seoDescription || null},
          ${input.status === "published" ? new Date() : null}
        )
        RETURNING id, slug, status
      `;
      auditAction = "post.created";
    }

    if (!saved) {
      throw new Error("POST_SAVE_FAILED");
    }

    await transaction`
      INSERT INTO admin_audit_events (
        id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        ${randomUUID()},
        ${auditAction},
        ${"blog_post"},
        ${saved.id},
        ${transaction.json({ slug: saved.slug, status: saved.status })}
      )
    `;

    return saved;
  });
}
