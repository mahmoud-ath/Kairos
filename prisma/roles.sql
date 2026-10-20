-- Split the database roles so the running app cannot change the schema.
--
-- Why: today one role (`kairos`) both migrates and serves traffic, so it holds DDL
-- rights. A SQL-injection-class bug — none is known — would escalate from "read
-- rows" to "DROP TABLE", and a bad deploy could do it without meaning to.
--
-- What this does:
--   kairos_app   — LOGIN, DML only (SELECT/INSERT/UPDATE/DELETE). What the app uses.
--   owner role   — unchanged. What `prisma migrate deploy` keeps using.
--
-- Prisma needs DDL only for `migrate`. The app never issues CREATE/ALTER/DROP, so
-- this is a drop-in change:
--
--   DATABASE_URL  → kairos_app          (pooled host in production)
--   DIRECT_URL    → the owner role      (direct host; migrations only)
--
-- Run it as the owner (it needs CREATEROLE/GRANT):
--
--   scripts/with-prod-env.sh bunx prisma db execute --stdin \
--     --schema prisma/schema.prisma < prisma/roles.sql
--
-- …but read docs/database-roles.md first: the password must not travel through
-- stdin history, so the documented form sets it through `psql` with a literal read
-- from an environment variable.
--
-- Idempotent: safe to re-run, and safe on a database that already has rows.

-- 1. The runtime role. A password is NOT set here on purpose — `CREATE ROLE …
--    PASSWORD 'x'` would end up in this file. Set it separately:
--      ALTER ROLE kairos_app PASSWORD '…';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kairos_app') THEN
    CREATE ROLE kairos_app LOGIN;
  END IF;
END
$$;

-- 2. Connect and see the schema, but not create in it.
--    `GRANT … ON DATABASE` wants a name, not a function, so build it from the
--    database we are actually connected to (the local database is `kairos`, the
--    production one is `postgres`).
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kairos_app', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO kairos_app;

-- 3. Row data, present and future.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kairos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kairos_app;

-- 4. Tables created by later migrations must be usable without re-running this.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kairos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kairos_app;

-- 5. Explicitly not granted, so a later `GRANT ALL` cannot creep in silently:
--      CREATE on SCHEMA public   (no new tables)
--      TRUNCATE                  (a runtime bug must not empty a table)
--      REFERENCES / TRIGGER
--
-- Verify what the role can actually do:
--      SELECT has_schema_privilege('kairos_app', 'public', 'CREATE');   -- false
--      SELECT has_table_privilege('kairos_app', 'Task', 'SELECT');      -- true
--      SELECT has_table_privilege('kairos_app', 'Task', 'TRUNCATE');    -- false
