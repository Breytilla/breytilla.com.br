import { z } from "zod";

export const MARKETING_CONSENT_VERSION = "2026-08-20" as const;

const optionalPhone = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .trim()
    .min(8)
    .max(30)
    .regex(/^[+()\-\s\d]+$/)
    .optional(),
);

const optionalFirstName = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(2).max(100).optional(),
);

export const contactRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: optionalPhone,
    preferredChannel: z.enum(["email", "whatsapp", "phone"]),
    marketingOptIn: z.boolean().optional().default(false),
    consentVersion: z.literal(MARKETING_CONSENT_VERSION).optional(),
    website: z.string().trim().max(0).optional().default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.preferredChannel === "whatsapp" ||
        value.preferredChannel === "phone") &&
      !value.phone
    ) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Telefone obrigatório para o canal escolhido.",
      });
    }

    if (value.marketingOptIn && !value.consentVersion) {
      context.addIssue({
        code: "custom",
        path: ["consentVersion"],
        message: "Versão do consentimento obrigatória.",
      });
    }
  });

export const newsletterRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    firstName: optionalFirstName,
    marketingConsent: z.literal(true),
    consentVersion: z.literal(MARKETING_CONSENT_VERSION),
    website: z.string().trim().max(0).optional().default(""),
  })
  .strict();

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
export type NewsletterRequestInput = z.infer<typeof newsletterRequestSchema>;
