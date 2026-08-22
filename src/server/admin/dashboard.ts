import { getDatabase } from "@/server/email/database";

export type DashboardSummary = {
  publishedPosts: number;
  draftPosts: number;
  confirmedSubscribers: number;
  campaigns: number;
  pendingRequests: number;
};

export type ContactSummary = {
  id: string;
  name: string | null;
  email: string;
  marketingStatus: string;
  createdAt: Date;
  requestStatus: string | null;
  preferredChannel: string | null;
  phone: string | null;
};

export type AuditEventSummary = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: Date;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [summary] = await getDatabase()<
    {
      published_posts: number;
      draft_posts: number;
      confirmed_subscribers: number;
      campaigns: number;
      pending_requests: number;
    }[]
  >`
    SELECT
      (SELECT count(*)::int FROM blog_posts WHERE status = 'published') AS published_posts,
      (SELECT count(*)::int FROM blog_posts WHERE status = 'draft') AS draft_posts,
      (
        SELECT count(*)::int
        FROM contacts
        WHERE resend_contact_id IS NOT NULL
          AND marketing_status = 'subscribed'
          AND marketing_confirmed_at IS NOT NULL
          AND marketing_sync_status = 'synced'
          AND marketing_blocked_reason IS NULL
          AND marketing_last_reconciled_at >= now() - interval '36 hours'
      ) AS confirmed_subscribers,
      (SELECT count(*)::int FROM campaigns) AS campaigns,
      (
        SELECT count(*)::int
        FROM contact_requests
        WHERE status IN ('received', 'acknowledged')
      ) AS pending_requests
  `;

  return {
    publishedPosts: summary?.published_posts ?? 0,
    draftPosts: summary?.draft_posts ?? 0,
    confirmedSubscribers: summary?.confirmed_subscribers ?? 0,
    campaigns: summary?.campaigns ?? 0,
    pendingRequests: summary?.pending_requests ?? 0,
  };
}

export async function listRecentAuditEvents(
  limit = 8,
): Promise<AuditEventSummary[]> {
  const rows = await getDatabase()<
    {
      id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      occurred_at: Date;
    }[]
  >`
    SELECT id, action, entity_type, entity_id, occurred_at
    FROM admin_audit_events
    ORDER BY occurred_at DESC, id DESC
    LIMIT ${Math.max(1, Math.min(limit, 20))}
  `;

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    occurredAt: new Date(row.occurred_at),
  }));
}

export async function listAdminContacts(limit = 100): Promise<ContactSummary[]> {
  const rows = await getDatabase()<
    {
      id: string;
      name: string | null;
      email: string;
      marketing_status: string;
      created_at: Date;
      request_status: string | null;
      preferred_channel: string | null;
      phone: string | null;
    }[]
  >`
    SELECT
      contacts.id,
      contacts.name,
      contacts.email,
      contacts.marketing_status,
      contacts.created_at,
      latest_request.status AS request_status,
      latest_request.preferred_channel,
      latest_request.phone
    FROM contacts
    LEFT JOIN LATERAL (
      SELECT status, preferred_channel, phone
      FROM contact_requests
      WHERE contact_id = contacts.id
      ORDER BY created_at DESC
      LIMIT 1
    ) AS latest_request ON true
    ORDER BY contacts.created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    marketingStatus: row.marketing_status,
    createdAt: new Date(row.created_at),
    requestStatus: row.request_status,
    preferredChannel: row.preferred_channel,
    phone: row.phone,
  }));
}
