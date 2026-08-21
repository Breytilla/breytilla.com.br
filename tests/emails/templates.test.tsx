import type { ReactElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";

import {
  ContactRequestInternalEmail,
  ContactRequestReceivedEmail,
  NewsletterConfirmOptInEmail,
  NewsletterEmail,
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
} from "@/emails";

type RenderCase = {
  name: string;
  element: ReactElement;
  marker: string;
};

const renderCases: RenderCase[] = [
  {
    name: "confirmação de contato",
    element: <ContactRequestReceivedEmail name="Pessoa Exemplo" />,
    marker: "Pessoa Exemplo",
  },
  {
    name: "aviso interno de contato",
    element: (
      <ContactRequestInternalEmail
        name="Pessoa Interna"
        email="pessoa@example.com"
        phone="+55 16 99999-0000"
        preferredChannel="whatsapp"
        requestId="d6e21a70-482d-4c14-95b0-e56e4d493f02"
        submittedAt="2026-08-20T13:30:00.000Z"
      />
    ),
    marker: "pessoa@example.com",
  },
  {
    name: "double opt-in",
    element: (
      <NewsletterConfirmOptInEmail
        name="Pessoa Assinante"
        confirmationUrl="https://breytilla.com.br/api/newsletter/confirm?token=token-de-teste"
      />
    ),
    marker: "Pessoa Assinante",
  },
  {
    name: "newsletter de marketing",
    element: (
      <NewsletterEmail
        preheader="Resumo desta edição"
        title="Uma edição de teste"
        intro="Introdução independente de conteúdo visual."
        sections={[
          {
            heading: "Seção determinística",
            paragraphs: ["Um parágrafo que deve aparecer nas duas versões."],
          },
        ]}
      />
    ),
    marker: "Uma edição de teste",
  },
];

describe("templates React Email", () => {
  it.each(renderCases)("renderiza HTML e texto simples: $name", async ({
    element,
    marker,
  }) => {
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain(marker);
    expect(text.toLocaleLowerCase("pt-BR")).toContain(
      marker.toLocaleLowerCase("pt-BR"),
    );
    expect(text).not.toMatch(/<\/?(?:html|body|table|p|a)(?:\s|>)/i);
  });

  it("preserva literalmente o placeholder de descadastro do Resend", async () => {
    const element = (
      <NewsletterEmail
        preheader="Resumo"
        title="Conteúdo"
        intro="Introdução"
        sections={[]}
      />
    );

    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    expect(html).toContain(RESEND_UNSUBSCRIBE_PLACEHOLDER);
    expect(html).toContain(`href="${RESEND_UNSUBSCRIBE_PLACEHOLDER}"`);
    expect(text).toContain(RESEND_UNSUBSCRIBE_PLACEHOLDER);
  });
});
