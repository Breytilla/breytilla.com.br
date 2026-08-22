CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'Reflexões',
  status text NOT NULL DEFAULT 'draft',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_valid CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT blog_posts_status_valid CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT blog_posts_published_at_valid CHECK (
    status <> 'published' OR published_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS blog_posts_publication_idx
  ON blog_posts (published_at DESC, id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS blog_posts_status_updated_idx
  ON blog_posts (status, updated_at DESC);

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS content jsonb;

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_content_object;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_content_object CHECK (
    content IS NULL OR jsonb_typeof(content) = 'object'
  );

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id uuid PRIMARY KEY,
  fingerprint_hash text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_login_attempts_fingerprint_shape CHECK (
    fingerprint_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_recent_idx
  ON admin_login_attempts (fingerprint_hash, occurred_at DESC);

CREATE INDEX IF NOT EXISTS admin_login_attempts_retention_idx
  ON admin_login_attempts (occurred_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  subject_hash text NOT NULL,
  credential_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_sessions_token_shape CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT admin_sessions_subject_shape CHECK (
    subject_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_idx
  ON admin_sessions (expires_at, last_seen_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id uuid PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_events_recent_idx
  ON admin_audit_events (occurred_at DESC, id);

DROP TRIGGER IF EXISTS blog_posts_set_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_set_updated_at
BEFORE UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION set_email_system_updated_at();

DO $admin_security$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'blog_posts',
    'admin_login_attempts',
    'admin_sessions',
    'admin_audit_events'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      'public',
      protected_table
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC',
      'public',
      protected_table
    );

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon',
        'public',
        protected_table
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM authenticated',
        'public',
        protected_table
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM service_role',
        'public',
        protected_table
      );
    END IF;
  END LOOP;
END
$admin_security$;
