export type AbsoluteUrl = `http://${string}` | `https://${string}`;

export const RESEND_UNSUBSCRIBE_PLACEHOLDER =
  "{{{RESEND_UNSUBSCRIBE_URL}}}" as const;

export type UnsubscribeUrl =
  | AbsoluteUrl
  | typeof RESEND_UNSUBSCRIBE_PLACEHOLDER;

export type PreferredContactChannel = "email" | "phone" | "whatsapp";

export interface ContactRequestReceivedEmailProps {
  name: string;
}

export interface ContactRequestInternalEmailProps {
  name: string;
  email: string;
  phone?: string;
  preferredChannel: PreferredContactChannel;
  requestId: string;
  submittedAt: string;
}

export interface NewsletterConfirmOptInEmailProps {
  name?: string;
  confirmationUrl: AbsoluteUrl;
}

export interface NewsletterSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface NewsletterCallToAction {
  label: string;
  url: AbsoluteUrl;
}

export interface NewsletterEmailProps {
  preheader: string;
  title: string;
  intro: string;
  sections: readonly NewsletterSection[];
  cta?: NewsletterCallToAction;
  unsubscribeUrl?: UnsubscribeUrl;
}
