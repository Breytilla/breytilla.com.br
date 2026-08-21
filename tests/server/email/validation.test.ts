import { describe, expect, it } from "vitest";

import {
  MARKETING_CONSENT_VERSION,
  contactRequestSchema,
  newsletterRequestSchema,
} from "@/server/email/validation";

describe("contactRequestSchema", () => {
  it("aceita um contato válido e aplica defaults seguros", () => {
    const result = contactRequestSchema.safeParse({
      name: "  Pessoa Exemplo  ",
      email: "  pessoa@example.com  ",
      preferredChannel: "email",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        name: "Pessoa Exemplo",
        email: "pessoa@example.com",
        preferredChannel: "email",
        marketingOptIn: false,
        website: "",
      });
    }
  });

  it("aceita opt-in explícito com versão de consentimento", () => {
    const result = contactRequestSchema.safeParse({
      name: "Pessoa Exemplo",
      email: "pessoa@example.com",
      phone: "+55 16 99999-0000",
      preferredChannel: "whatsapp",
      marketingOptIn: true,
      consentVersion: MARKETING_CONSENT_VERSION,
      website: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = contactRequestSchema.safeParse({
      name: "Pessoa Exemplo",
      email: "email-invalido",
      preferredChannel: "email",
    });

    expect(result.success).toBe(false);
  });

  it("rejeita opt-in sem versão do consentimento", () => {
    const result = contactRequestSchema.safeParse({
      name: "Pessoa Exemplo",
      email: "pessoa@example.com",
      preferredChannel: "email",
      marketingOptIn: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita honeypot preenchido", () => {
    const result = contactRequestSchema.safeParse({
      name: "Pessoa Exemplo",
      email: "pessoa@example.com",
      preferredChannel: "email",
      website: "https://spam.example",
    });

    expect(result.success).toBe(false);
  });

  it("exige telefone quando o canal escolhido depende dele", () => {
    const result = contactRequestSchema.safeParse({
      name: "Pessoa Exemplo",
      email: "pessoa@example.com",
      preferredChannel: "phone",
    });

    expect(result.success).toBe(false);
  });
});

describe("newsletterRequestSchema", () => {
  it("aceita inscrição com consentimento explícito", () => {
    const result = newsletterRequestSchema.safeParse({
      email: "  assinante@example.com  ",
      firstName: "  Pessoa  ",
      marketingConsent: true,
      consentVersion: MARKETING_CONSENT_VERSION,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "assinante@example.com",
        firstName: "Pessoa",
        marketingConsent: true,
        consentVersion: MARKETING_CONSENT_VERSION,
        website: "",
      });
    }
  });

  it("rejeita consentimento ausente", () => {
    const result = newsletterRequestSchema.safeParse({
      email: "assinante@example.com",
      consentVersion: MARKETING_CONSENT_VERSION,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const result = newsletterRequestSchema.safeParse({
      email: "email-invalido",
      marketingConsent: true,
      consentVersion: MARKETING_CONSENT_VERSION,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita honeypot preenchido", () => {
    const result = newsletterRequestSchema.safeParse({
      email: "assinante@example.com",
      marketingConsent: true,
      consentVersion: MARKETING_CONSENT_VERSION,
      website: "robô",
    });

    expect(result.success).toBe(false);
  });

  it("rejeita uma versão de consentimento desatualizada", () => {
    const result = newsletterRequestSchema.safeParse({
      email: "assinante@example.com",
      marketingConsent: true,
      consentVersion: "versao-antiga",
    });

    expect(result.success).toBe(false);
  });
});
