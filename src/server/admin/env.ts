import { z } from "zod";

export const RESERVED_ADMIN_ROUTE_KEYS = [
  "blog",
  "privacidade",
  "newsletter",
  "api",
] as const;

const adminEnvSchema = z.object({
  ADMIN_ROUTE_KEY: z
    .string()
    .trim()
    .min(6)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .refine(
      (value) =>
        !(RESERVED_ADMIN_ROUTE_KEYS as readonly string[]).includes(value),
    ),
  ADMIN_USERNAME: z.string().trim().min(3).max(160),
  ADMIN_PASSWORD_HASH: z
    .string()
    .trim()
    .regex(
      /^scrypt\.32768\.8\.1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{86}$/,
      "Gere o hash com npm run admin:hash-password.",
    ),
  ADMIN_SESSION_SECRET: z.string().min(32),
  ADMIN_DISPLAY_NAME: z.string().trim().min(1).max(80).default("Breytilla"),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

/** Reads admin-only configuration at request time, never into the client bundle. */
export function getAdminEnv(): AdminEnv {
  return adminEnvSchema.parse({
    ...process.env,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME || "Breytilla",
  });
}
