import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

import { getDatabase } from "@/server/email/database";
import { getAdminEnv, RESERVED_ADMIN_ROUTE_KEYS } from "./env";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-breytilla_admin_session"
    : "breytilla_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const ADMIN_PASSWORD_MAX_LENGTH = 512;

type AdminSessionRow = {
  sub: string;
  created_at: Date;
  expires_at: Date;
};

export type AdminSession = {
  sub: string;
  name: string;
  issuedAt: number;
  expiresAt: number;
};

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function stableTextEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function credentialVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

function parsePasswordHash(encoded: string): {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
} | null {
  const [algorithm, nValue, rValue, pValue, saltValue, hashValue] =
    encoded.split(".");
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (
    algorithm !== "scrypt" ||
    N !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    if (salt.length < 16 || expected.length !== SCRYPT_KEY_LENGTH) {
      return null;
    }
    return { N, r, p, salt, expected };
  } catch {
    return null;
  }
}

export async function createAdminPasswordHash(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("A senha administrativa deve ter pelo menos 12 caracteres.");
  }
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    throw new Error("A senha administrativa deve ter no máximo 512 caracteres.");
  }

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 96 * 1024 * 1024,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join(".");
}

export async function verifyAdminPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed) {
    return false;
  }

  const actual = await scrypt(password, parsed.salt, parsed.expected.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 96 * 1024 * 1024,
  });
  return timingSafeEqual(actual, parsed.expected);
}

export function isAdminRouteKey(candidate: string): boolean {
  const configuredKey = process.env.ADMIN_ROUTE_KEY?.trim();
  if (
    !configuredKey ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(configuredKey) ||
    configuredKey.length < 6 ||
    configuredKey.length > 64 ||
    (RESERVED_ADMIN_ROUTE_KEYS as readonly string[]).includes(configuredKey)
  ) {
    return false;
  }
  return stableTextEqual(candidate, configuredKey);
}

export async function verifyAdminCredentials(input: {
  username: string;
  password: string;
}): Promise<boolean> {
  const environment = getAdminEnv();
  const usernameMatches = stableTextEqual(
    input.username.trim().toLocaleLowerCase("pt-BR"),
    environment.ADMIN_USERNAME.toLocaleLowerCase("pt-BR"),
  );
  const passwordMatches = await verifyAdminPassword(
    input.password,
    environment.ADMIN_PASSWORD_HASH,
  );

  return usernameMatches && passwordMatches;
}

function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function adminSubjectHash(username: string): string {
  return createHash("sha256")
    .update(username.toLocaleLowerCase("pt-BR"))
    .digest("hex");
}

function isSessionTokenShape(token: string | undefined): token is string {
  return Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token));
}

export async function getAdminSession(
  accessKey: string,
): Promise<AdminSession | null> {
  if (!isAdminRouteKey(accessKey)) {
    return null;
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isSessionTokenShape(token)) {
    return null;
  }

  const environment = getAdminEnv();
  const [session] = await getDatabase()<AdminSessionRow[]>`
    SELECT
      subject_hash AS sub,
      created_at,
      expires_at
    FROM admin_sessions
    WHERE token_hash = ${sessionTokenHash(token)}
      AND subject_hash = ${adminSubjectHash(environment.ADMIN_USERNAME)}
      AND credential_version = ${credentialVersion(environment.ADMIN_PASSWORD_HASH)}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;

  if (!session) {
    return null;
  }

  return {
    sub: session.sub,
    name: environment.ADMIN_DISPLAY_NAME,
    issuedAt: new Date(session.created_at).getTime(),
    expiresAt: new Date(session.expires_at).getTime(),
  };
}

export async function setAdminSessionCookie(): Promise<void> {
  const environment = getAdminEnv();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1_000);

  await getDatabase().begin(async (transaction) => {
    await transaction`
      INSERT INTO admin_sessions (
        id,
        token_hash,
        subject_hash,
        credential_version,
        expires_at
      ) VALUES (
        ${randomUUID()},
        ${sessionTokenHash(token)},
        ${adminSubjectHash(environment.ADMIN_USERNAME)},
        ${credentialVersion(environment.ADMIN_PASSWORD_HASH)},
        ${expiresAt}
      )
    `;
    await transaction`
      DELETE FROM admin_sessions
      WHERE expires_at < now() - interval '30 days'
         OR revoked_at < now() - interval '30 days'
    `;
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (isSessionTokenShape(token)) {
    await getDatabase()`
      UPDATE admin_sessions
      SET revoked_at = now()
      WHERE token_hash = ${sessionTokenHash(token)}
        AND revoked_at IS NULL
    `;
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    priority: "high",
  });
}

export function createLoginFingerprint(input: {
  clientAddress: string;
}): string {
  const environment = getAdminEnv();
  return createHmac("sha256", environment.ADMIN_SESSION_SECRET)
    .update("admin-login-ip\0")
    .update(input.clientAddress)
    .digest("hex");
}

export function createAccountLoginFingerprint(): string {
  const environment = getAdminEnv();
  return createHmac("sha256", environment.ADMIN_SESSION_SECRET)
    .update("admin-login-account\0")
    .update(environment.ADMIN_USERNAME.toLocaleLowerCase("pt-BR"))
    .digest("hex");
}
