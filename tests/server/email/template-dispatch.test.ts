import { describe, expect, it } from "vitest";

import { renderTransactionalTemplate } from "@/server/email/templates";

describe("renderTransactionalTemplate", () => {
  it.each([
    {
      template: "contact-request-received" as const,
      payload: { name: "Pessoa Recebedora" },
      subject: "Recebemos sua solicitação",
      marker: "Pessoa Recebedora",
    },
    {
      template: "contact-request-internal" as const,
      payload: {
        name: "Pessoa Interna",
        email: "interna@example.com",
        phone: "+55 16 99999-0000",
        preferredChannel: "whatsapp",
        requestId: "b9942b9a-11f1-48f9-91e2-111e17861a1b",
        submittedAt: "2026-08-20T13:30:00.000Z",
      },
      subject: "Novo contato pelo site",
      marker: "interna@example.com",
    },
    {
      template: "newsletter-confirm-opt-in" as const,
      payload: {
        name: "Pessoa Assinante",
        confirmationUrl:
          "https://breytilla.com.br/api/newsletter/confirm?token=token-de-teste",
      },
      subject: "Confirme sua inscrição",
      marker: "Pessoa Assinante",
    },
  ])("despacha $template para o template correto", async ({
    template,
    payload,
    subject,
    marker,
  }) => {
    const result = await renderTransactionalTemplate(template, payload);

    expect(result.subject).toBe(subject);
    expect(result.html).toContain(marker);
    expect(result.text.toLocaleLowerCase("pt-BR")).toContain(
      marker.toLocaleLowerCase("pt-BR"),
    );
  });

  it("rejeita payload incompatível com o template", async () => {
    await expect(
      renderTransactionalTemplate("contact-request-received", {
        email: "sem-nome@example.com",
      }),
    ).rejects.toThrow();
  });
});
