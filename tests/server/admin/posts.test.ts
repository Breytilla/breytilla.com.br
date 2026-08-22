import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/server/email/database", () => ({
  getDatabase: mocks.getDatabase,
}));

import {
  blogPostInputSchema,
  slugifyPostTitle,
} from "@/server/admin/posts";

const validInput = () => ({
  title: "Título válido",
  slug: "titulo-valido",
  excerpt: "E".repeat(20),
  content: "C".repeat(80),
  category: "Saúde",
  status: "draft" as const,
});

describe("slugifyPostTitle", () => {
  it("remove acentos e normaliza separadores", () => {
    expect(slugifyPostTitle("  Saúde, Emoções & Relações!  ")).toBe(
      "saude-emocoes-relacoes",
    );
  });

  it("respeita o limite de 160 caracteres sem hífen final", () => {
    const slug = slugifyPostTitle(`${"a".repeat(159)} conteúdo adicional`);

    expect(slug.length).toBeLessThanOrEqual(160);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("blogPostInputSchema", () => {
  it("aceita valores exatamente nos limites máximos", () => {
    const result = blogPostInputSchema.safeParse({
      ...validInput(),
      title: "T".repeat(140),
      slug: "s".repeat(160),
      excerpt: "E".repeat(320),
      content: "C".repeat(50_000),
      category: "C".repeat(60),
      seoTitle: "S".repeat(70),
      seoDescription: "D".repeat(170),
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["title", "T".repeat(3)],
    ["title", "T".repeat(141)],
    ["slug", "s".repeat(161)],
    ["excerpt", "E".repeat(19)],
    ["excerpt", "E".repeat(321)],
    ["content", "C".repeat(79)],
    ["content", "C".repeat(50_001)],
    ["category", "C"],
    ["category", "C".repeat(61)],
    ["seoTitle", "S".repeat(71)],
    ["seoDescription", "D".repeat(171)],
  ] as const)("rejeita %s fora do limite", (field, value) => {
    const result = blogPostInputSchema.safeParse({
      ...validInput(),
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita slug fora do formato canônico", () => {
    const result = blogPostInputSchema.safeParse({
      ...validInput(),
      slug: "Slug Inválido",
    });

    expect(result.success).toBe(false);
  });

  it.each(["draft", "published", "archived"] as const)(
    "aceita o status %s",
    (status) => {
      const result = blogPostInputSchema.safeParse({
        ...validInput(),
        status,
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejeita status desconhecido", () => {
    const result = blogPostInputSchema.safeParse({
      ...validInput(),
      status: "deleted",
    });

    expect(result.success).toBe(false);
  });
});
