\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oroaroma_runtime') THEN
    CREATE ROLE oroaroma_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE :"DB_NAME" TO oroaroma_runtime;
GRANT USAGE ON SCHEMA public TO oroaroma_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oroaroma_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oroaroma_runtime;
GRANT EXECUTE ON FUNCTION public.resolve_login_tenant(text) TO oroaroma_runtime;
GRANT EXECUTE ON FUNCTION public.resolve_refresh_tenant(text) TO oroaroma_runtime;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(text) TO oroaroma_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oroaroma_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO oroaroma_runtime;

GRANT oroaroma_runtime TO :"RUNTIME_LOGIN";
