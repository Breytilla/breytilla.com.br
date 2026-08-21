CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  resend_contact_id text,
  marketing_status text NOT NULL DEFAULT 'never_subscribed',
  marketing_status_updated_at timestamptz,
  marketing_confirmed_at timestamptz,
  marketing_opted_out_at timestamptz,
  marketing_blocked_reason text,
  marketing_last_reconciled_at timestamptz,
  marketing_sync_status text NOT NULL DEFAULT 'idle',
  marketing_sync_generation uuid,
  marketing_sync_attempts integer NOT NULL DEFAULT 0,
  marketing_sync_next_attempt_at timestamptz,
  marketing_sync_last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT contacts_marketing_status_valid CHECK (
    marketing_status IN (
      'never_subscribed',
      'pending',
      'subscribed',
      'unsubscribed',
      'blocked'
    )
  ),
  CONSTRAINT contacts_marketing_sync_status_valid CHECK (
    marketing_sync_status IN ('idle', 'pending', 'synced', 'failed')
  ),
  CONSTRAINT contacts_marketing_sync_attempts_nonnegative CHECK (
    marketing_sync_attempts >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_resend_contact_id_unique
  ON contacts (resend_contact_id)
  WHERE resend_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_marketing_status_idx
  ON contacts (marketing_status, updated_at DESC);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_last_reconciled_at timestamptz;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_sync_status text NOT NULL DEFAULT 'idle';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_sync_generation uuid;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_sync_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_sync_next_attempt_at timestamptz;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_sync_last_error text;

CREATE INDEX IF NOT EXISTS contacts_marketing_reconcile_idx
  ON contacts (marketing_last_reconciled_at ASC NULLS FIRST, id)
  WHERE resend_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_marketing_sync_idx
  ON contacts (marketing_sync_next_attempt_at, marketing_confirmed_at)
  WHERE marketing_sync_status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS contact_requests (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  phone text,
  preferred_channel text NOT NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_requests_preferred_channel_valid CHECK (
    preferred_channel IN ('email', 'whatsapp', 'phone')
  ),
  CONSTRAINT contact_requests_status_valid CHECK (
    status IN ('received', 'acknowledged', 'handled', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS contact_requests_contact_created_idx
  ON contact_requests (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_requests_status_created_idx
  ON contact_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_requests_created_idx
  ON contact_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  topic_key text NOT NULL,
  action text NOT NULL,
  source text NOT NULL,
  consent_version text,
  provider_event_id text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_events_action_valid CHECK (
    action IN (
      'opt_in_requested',
      'opt_in_confirmed',
      'opted_out',
      'bounced',
      'complained',
      'suppressed'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_events_provider_event_unique
  ON consent_events (provider_event_id, contact_id, action)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS consent_events_contact_occurred_idx
  ON consent_events (contact_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS consent_events_topic_action_idx
  ON consent_events (topic_key, action, occurred_at DESC);

CREATE TABLE IF NOT EXISTS confirmation_tokens (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  consent_version text NOT NULL,
  source text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT confirmation_tokens_hash_shape CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS confirmation_tokens_contact_active_idx
  ON confirmation_tokens (contact_id, expires_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS confirmation_tokens_expiry_idx
  ON confirmation_tokens (expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  stream text NOT NULL DEFAULT 'transactional',
  template_name text NOT NULL,
  template_version text NOT NULL DEFAULT 'v1',
  recipient_email text NOT NULL,
  encrypted_payload text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  resend_email_id text,
  provider_status_at timestamptz,
  last_error_code text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_stream_valid CHECK (stream = 'transactional'),
  CONSTRAINT email_outbox_status_valid CHECK (
    status IN (
      'pending',
      'processing',
      'retrying',
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained',
      'suppressed'
    )
  ),
  CONSTRAINT email_outbox_attempts_nonnegative CHECK (attempts >= 0),
  CONSTRAINT email_outbox_recipient_normalized CHECK (
    recipient_email = lower(btrim(recipient_email))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_resend_email_id_unique
  ON email_outbox (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz;

UPDATE email_outbox
SET provider_status_at = COALESCE(delivered_at, sent_at, updated_at)
WHERE provider_status_at IS NULL
  AND status IN ('delivered', 'delayed', 'bounced', 'complained', 'suppressed');

CREATE INDEX IF NOT EXISTS email_outbox_dispatch_idx
  ON email_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS email_outbox_stale_processing_idx
  ON email_outbox (locked_at)
  WHERE status = 'processing';

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  campaign_key text NOT NULL UNIQUE,
  name text NOT NULL,
  template_name text NOT NULL,
  template_version text NOT NULL,
  subject text NOT NULL,
  preheader text NOT NULL,
  resend_topic_id text NOT NULL,
  resend_segment_id text NOT NULL,
  resend_broadcast_id text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_status_valid CHECK (
    status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_resend_broadcast_id_unique
  ON campaigns (resend_broadcast_id)
  WHERE resend_broadcast_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaigns_status_schedule_idx
  ON campaigns (status, scheduled_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  provider_created_at timestamptz,
  status text NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  last_error_code text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_status_valid CHECK (
    status IN ('processing', 'processed', 'failed')
  ),
  CONSTRAINT webhook_events_attempts_positive CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS webhook_events_status_updated_idx
  ON webhook_events (status, updated_at);

CREATE OR REPLACE FUNCTION set_email_system_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts;
CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();

DROP TRIGGER IF EXISTS contact_requests_set_updated_at ON contact_requests;
CREATE TRIGGER contact_requests_set_updated_at
BEFORE UPDATE ON contact_requests
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();

DROP TRIGGER IF EXISTS email_outbox_set_updated_at ON email_outbox;
CREATE TRIGGER email_outbox_set_updated_at
BEFORE UPDATE ON email_outbox
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;
CREATE TRIGGER campaigns_set_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();

DROP TRIGGER IF EXISTS webhook_events_set_updated_at ON webhook_events;
CREATE TRIGGER webhook_events_set_updated_at
BEFORE UPDATE ON webhook_events
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();
