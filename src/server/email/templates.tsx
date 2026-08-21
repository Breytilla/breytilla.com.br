import { createElement, type ReactElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import {
  ContactRequestInternalEmail,
  ContactRequestReceivedEmail,
  NewsletterConfirmOptInEmail,
  type AbsoluteUrl,
} from "@/emails";

import type {
  EmailPayloadByTemplate,
  TransactionalTemplateName,
} from "./outbox";

const payloadSchemas = {
  "contact-request-received": z
    .object({ name: z.string().min(1).max(100) })
    .strict(),
  "contact-request-internal": z
    .object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(254),
      phone: z.string().max(30).optional(),
      preferredChannel: z.enum(["email", "whatsapp", "phone"]),
      requestId: z.string().uuid(),
      submittedAt: z.string().datetime(),
    })
    .strict(),
  "newsletter-confirm-opt-in": z
    .object({
      name: z.string().min(1).max(100).optional(),
      confirmationUrl: z.string().url(),
    })
    .strict(),
} satisfies {
  [Template in TransactionalTemplateName]: z.ZodType<
    EmailPayloadByTemplate[Template]
  >;
};

const subjects: Record<TransactionalTemplateName, string> = {
  "contact-request-received": "Recebemos sua solicitação",
  "contact-request-internal": "Novo contato pelo site",
  "newsletter-confirm-opt-in": "Confirme sua inscrição",
};

function createTemplateElement(
  template: TransactionalTemplateName,
  payload: unknown,
): ReactElement {
  switch (template) {
    case "contact-request-received":
      return createElement(
        ContactRequestReceivedEmail,
        payloadSchemas[template].parse(payload),
      );
    case "contact-request-internal":
      return createElement(
        ContactRequestInternalEmail,
        payloadSchemas[template].parse(payload),
      );
    case "newsletter-confirm-opt-in": {
      const properties = payloadSchemas[template].parse(payload);
      return createElement(NewsletterConfirmOptInEmail, {
        ...properties,
        confirmationUrl: properties.confirmationUrl as AbsoluteUrl,
      });
    }
  }
}

/** Renders both MIME alternatives from the versioned React Email registry. */
export async function renderTransactionalTemplate(
  template: TransactionalTemplateName,
  payload: unknown,
): Promise<{ subject: string; html: string; text: string }> {
  const element = createTemplateElement(template, payload);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: subjects[template], html, text };
}
