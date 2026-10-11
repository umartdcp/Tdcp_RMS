-- Run in pgAdmin Query Tool while connected to database: postgres
-- (Servers → PostgreSQL 18 → Databases → postgres → Query Tool)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'tdcp') THEN
    CREATE ROLE tdcp LOGIN PASSWORD 'tdcp123';
  END IF;
END
$$;

SELECT 'Database role tdcp is ready. Next: create database tdcp_rms if it does not exist.';
