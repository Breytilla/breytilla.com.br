import { describe, expect, it } from "vitest";

import {
  generateConfirmationToken,
  hashConfirmationToken,
  normalizeEmail,
  secureTokenEquals,
} from "@/server/email/crypto";

describe("utilitários criptográficos de e-mail", () => {
  it("normaliza endereços antes da persistência", () => {
    expect(normalizeEmail("  Pessoa.Exemplo@Example.COM  ")).toBe(
      "pessoa.exemplo@example.com",
    );
  });

  it("gera tokens URL-safe com 256 bits", () => {
    const first = generateConfirmationToken();
    const second = generateConfirmationToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("produz hashes SHA-256 determinísticos sem expor o token", () => {
    const token = "token-de-confirmacao";
    const firstHash = hashConfirmationToken(token);

    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashConfirmationToken(token)).toBe(firstHash);
    expect(hashConfirmationToken(`${token}-diferente`)).not.toBe(firstHash);
    expect(firstHash).not.toContain(token);
  });

  it("compara credenciais pelo conteúdo completo", () => {
    expect(secureTokenEquals("segredo", "segredo")).toBe(true);
    expect(secureTokenEquals("segredo", "outro-segredo")).toBe(false);
  });
});
