import { randomUUID } from "node:crypto";

import { getDatabase } from "@/server/email/database";

export type LoginGuardResult = "allowed" | "invalid" | "locked";
export type LoginLimitBucket = {
  fingerprintHash: string;
  maxFailures: number;
};

/** Reserves rate-limit capacity before doing expensive password derivation. */
export async function verifyWithinLoginLimit(
  buckets: LoginLimitBucket[],
  verify: () => Promise<boolean>,
): Promise<LoginGuardResult> {
  const orderedBuckets = [...buckets].sort((left, right) =>
    left.fingerprintHash.localeCompare(right.fingerprintHash),
  );
  const reservations = orderedBuckets.map((bucket) => ({
    ...bucket,
    id: randomUUID(),
  }));

  const reserved = await getDatabase().begin(async (transaction) => {
    for (const bucket of orderedBuckets) {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtext(${"admin-login:" + bucket.fingerprintHash})
        )
      `;
    }

    for (const bucket of orderedBuckets) {
      const [recent] = await transaction<{ failures: number }[]>`
        SELECT count(*)::int AS failures
        FROM admin_login_attempts
        WHERE fingerprint_hash = ${bucket.fingerprintHash}
          AND succeeded = false
          AND occurred_at >= now() - interval '15 minutes'
      `;

      if ((recent?.failures ?? 0) >= bucket.maxFailures) {
        return false;
      }
    }

    for (const reservation of reservations) {
      await transaction`
        INSERT INTO admin_login_attempts (
          id,
          fingerprint_hash,
          succeeded,
          occurred_at
        ) VALUES (
          ${reservation.id},
          ${reservation.fingerprintHash},
          false,
          now()
        )
      `;
    }

    await transaction`
      DELETE FROM admin_login_attempts
      WHERE occurred_at < now() - interval '30 days'
    `;
    return true;
  });

  if (!reserved) {
    return "locked";
  }

  const valid = await verify();
  if (!valid) {
    return "invalid";
  }

  await getDatabase().begin(async (transaction) => {
    for (const bucket of orderedBuckets) {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtext(${"admin-login:" + bucket.fingerprintHash})
        )
      `;
    }

    for (const reservation of reservations) {
      await transaction`
        UPDATE admin_login_attempts
        SET succeeded = true
        WHERE id = ${reservation.id}
      `;
      await transaction`
        DELETE FROM admin_login_attempts
        WHERE fingerprint_hash = ${reservation.fingerprintHash}
          AND succeeded = false
      `;
    }
  });

  return "allowed";
}
