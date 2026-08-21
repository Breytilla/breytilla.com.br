import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmNewsletterSubscription: vi.fn(),
}));

vi.mock("@/server/email/env", () => ({
  getAppEnv: () => ({ APP_URL: "https://breytilla.com.br" }),
}));

vi.mock("@/server/email/subscriptions", () => ({
  confirmNewsletterSubscription: mocks.confirmNewsletterSubscription,
}));

import { GET, POST } from "@/app/api/newsletter/confirm/route";

const validToken = "a".repeat(43);

describe("newsletter confirmation route", () => {
  beforeEach(() => {
    mocks.confirmNewsletterSubscription.mockReset();
  });

  it("does not consume the token on GET", () => {
    const response = GET(
      new Request(
        `https://breytilla.com.br/api/newsletter/confirm?token=${validToken}`,
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://breytilla.com.br/newsletter/confirmar?token=${validToken}`,
    );
    expect(mocks.confirmNewsletterSubscription).not.toHaveBeenCalled();
  });

  it("consumes a token only on an explicit same-origin POST", async () => {
    mocks.confirmNewsletterSubscription.mockResolvedValue("confirmed");
    const response = await POST(
      new Request("https://breytilla.com.br/api/newsletter/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://breytilla.com.br",
        },
        body: new URLSearchParams({ token: validToken }),
      }),
    );

    expect(mocks.confirmNewsletterSubscription).toHaveBeenCalledWith(
      validToken,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://breytilla.com.br/newsletter/confirmado?status=confirmed",
    );
  });

  it("rejects a mutation without a browser Origin", async () => {
    const response = await POST(
      new Request("https://breytilla.com.br/api/newsletter/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: validToken }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.confirmNewsletterSubscription).not.toHaveBeenCalled();
  });
});
