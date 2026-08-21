-- These tables are accessed only by the server-side database owner. Enabling
-- RLS without policies makes every non-owner, non-BYPASSRLS role default-deny.
-- Do not use FORCE ROW LEVEL SECURITY: the application/migration owner must
-- retain access through the server-side Postgres connection.
DO $email_security$
DECLARE
  email_table text;
  api_role text;
  required_email_tables constant text[] := ARRAY[
    'contacts',
    'contact_requests',
    'consent_events',
    'confirmation_tokens',
    'email_outbox',
    'campaigns',
    'webhook_events'
  ];
  protected_tables constant text[] := required_email_tables || ARRAY[
    'schema_migrations'
  ];
BEGIN
  FOREACH email_table IN ARRAY protected_tables
  LOOP
    IF to_regclass(format('%I.%I', 'public', email_table)) IS NULL THEN
      -- The project runner creates this metadata table outside the SQL files.
      -- Keep manual execution of this migration compatible with its absence.
      IF email_table = 'schema_migrations' THEN
        CONTINUE;
      END IF;

      RAISE EXCEPTION 'Required email table public.% does not exist', email_table;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      'public',
      email_table
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC',
      'public',
      email_table
    );

    -- Supabase API roles do not exist on every PostgreSQL host. service_role is
    -- revoked explicitly because it can bypass RLS and this app never uses it.
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I',
          'public',
          email_table,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;

  -- The current schema uses application-generated UUIDs and creates no
  -- sequences. This also protects any serial/identity sequences owned by these
  -- tables in an older installation without affecting unrelated sequences.
  FOR email_table IN
    SELECT sequence_class.relname
    FROM pg_class AS sequence_class
    JOIN pg_namespace AS sequence_namespace
      ON sequence_namespace.oid = sequence_class.relnamespace
    JOIN pg_depend AS sequence_dependency
      ON sequence_dependency.classid = 'pg_class'::regclass
      AND sequence_dependency.objid = sequence_class.oid
      AND sequence_dependency.refclassid = 'pg_class'::regclass
      AND sequence_dependency.deptype IN ('a', 'i')
    JOIN pg_class AS owning_table
      ON owning_table.oid = sequence_dependency.refobjid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = owning_table.relnamespace
    WHERE sequence_class.relkind = 'S'
      AND sequence_namespace.nspname = 'public'
      AND table_namespace.nspname = 'public'
      AND owning_table.relname = ANY (required_email_tables)
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC',
      'public',
      email_table
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I',
          'public',
          email_table,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;
END
$email_security$;
