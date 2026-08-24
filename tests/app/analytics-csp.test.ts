import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function getContentSecurityPolicy(nodeEnv: "development" | "production") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  const { default: nextConfig } = await import("../../next.config");
  const rules = (await nextConfig.headers?.()) ?? [];

  return rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
}

describe("Google Analytics Content Security Policy", () => {
  it("allows only the required Google tag and collection endpoints in production", async () => {
    const policy = await getContentSecurityPolicy("production");

    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    );
    expect(policy).toContain("https://*.google-analytics.com");
    expect(policy).toContain("https://*.analytics.google.com");
    expect(policy).toContain("https://www.googletagmanager.com");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain(" ws:");
  });

  it("preserves the development-only sources", async () => {
    const policy = await getContentSecurityPolicy("development");

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain(" ws: wss:");
    expect(policy).toContain("https://*.google-analytics.com");
  });
});
