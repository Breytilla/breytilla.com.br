import { randomUUID } from "node:crypto";

import { getDatabase } from "@/server/email/database";

export async function recordAdminAuditEvent(input: {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getDatabase()`
    INSERT INTO admin_audit_events (
      id,
      action,
      entity_type,
      entity_id,
      metadata,
      occurred_at
    ) VALUES (
      ${randomUUID()},
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${getDatabase().json(input.metadata ?? {})},
      now()
    )
  `;
}
