import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getOutboxEncryptionEnv } from "./env";

const TOKEN_BYTES = 32;
const OUTBOX_PAYLOAD_VERSION = "v1";

/** Converts an address into the canonical representation persisted by the app. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Generates a cryptographically random, URL-safe confirmation token. */
export function generateConfirmationToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Produces the only representation of a confirmation token stored in its table. */
export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Validates an internal Bearer credential without a timing-sensitive comparison. */
export function secureTokenEquals(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}

function getPayloadEncryptionKey(): Buffer {
  return createHash("sha256")
    .update("breytilla-email-outbox-v1\0", "utf8")
    .update(
      getOutboxEncryptionEnv().EMAIL_OUTBOX_ENCRYPTION_KEY,
      "utf8",
    )
    .digest();
}

/** Encrypts template properties so confirmation tokens are never stored in plaintext. */
export function encryptOutboxPayload(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPayloadEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    OUTBOX_PAYLOAD_VERSION,
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypts a worker payload and rejects unknown ciphertext versions. */
export function decryptOutboxPayload(payload: string): unknown {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
    payload.split(".");

  if (
    version !== OUTBOX_PAYLOAD_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra
  ) {
    throw new Error("INVALID_ENCRYPTED_PAYLOAD");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getPayloadEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as unknown;
}
