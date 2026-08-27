import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/server/email/database", () => ({
  getDatabase: mocks.getDatabase,
}));

import {
  createAdminPasswordHash,
  verifyAdminPassword,
} from "@/server/admin/auth";

describe("admin password hashing", () => {
  const password = "Segura-12345";
  let encodedHash: string;

  beforeAll(async () => {
    encodedHash = await createAdminPasswordHash(password);
  });

  it("aceita a senha correta", async () => {
    expect(encodedHash).toMatch(
      /^scrypt\.32768\.8\.1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    );
    await expect(verifyAdminPassword(password, encodedHash)).resolves.toBe(
      true,
    );
  });

  it("rejeita uma senha incorreta", async () => {
    await expect(
      verifyAdminPassword("Outra-senha-123", encodedHash),
    ).resolves.toBe(false);
  });

  it("rejeita um hash malformado sem acessar cookies ou banco", async () => {
    await expect(
      verifyAdminPassword("qualquer-senha", "hash-invalido"),
    ).resolves.toBe(false);

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it("rejeita custos scrypt diferentes do padrÃ£o operacional", async () => {
    const alteredCost = encodedHash.replace("scrypt.32768.8.1.", "scrypt.262144.32.4.");
    await expect(
      verifyAdminPassword(password, alteredCost),
    ).resolves.toBe(false);
  });

  it("aceita uma senha com exatamente 8 caracteres", async () => {
    await expect(createAdminPasswordHash("Abc123!x")).resolves.toMatch(
      /^scrypt\.32768\.8\.1\./,
    );
  });

  it("não cria hash para senha com menos de 8 caracteres", async () => {
    await expect(createAdminPasswordHash("Ab12!xy")).rejects.toThrow(
      "pelo menos 8 caracteres",
    );
  });

  it("não cria uma senha que o formulário de login não poderia enviar", async () => {
    await expect(createAdminPasswordHash("a".repeat(513))).rejects.toThrow(
      "no máximo 512 caracteres",
    );
  });
});
