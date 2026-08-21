import { NewsletterEmail } from "./marketing/newsletter";
import { ContactRequestInternalEmail } from "./transactional/contact-request-internal";
import { ContactRequestReceivedEmail } from "./transactional/contact-request-received";
import { NewsletterConfirmOptInEmail } from "./transactional/newsletter-confirm-opt-in";

export const transactionalEmailTemplates = {
  "contact-request-internal": ContactRequestInternalEmail,
  "contact-request-received": ContactRequestReceivedEmail,
  "newsletter-confirm-opt-in": NewsletterConfirmOptInEmail,
} as const;

export const marketingEmailTemplates = {
  newsletter: NewsletterEmail,
} as const;

export const emailTemplateRegistry = {
  transactional: transactionalEmailTemplates,
  marketing: marketingEmailTemplates,
} as const;

export type TransactionalEmailTemplateName =
  keyof typeof transactionalEmailTemplates;
export type MarketingEmailTemplateName = keyof typeof marketingEmailTemplates;
export type EmailTemplateStream = keyof typeof emailTemplateRegistry;
