CREATE OR REPLACE FUNCTION public.resolve_login_tenant(candidate_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u."tenantId"
  FROM public."User" u
  JOIN public."Tenant" t ON t.id = u."tenantId"
  WHERE lower(u.email) = lower(candidate_email)
    AND u."deletedAt" IS NULL
    AND u.status = 'ACTIVE'
    AND t.status = 'ACTIVE'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.resolve_refresh_tenant(candidate_hash text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r."tenantId"
  FROM public."RefreshSession" r
  WHERE r."tokenHash" = candidate_hash
    AND r."revokedAt" IS NULL
    AND r."expiresAt" > CURRENT_TIMESTAMP
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_login_tenant(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_refresh_tenant(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oroaroma_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.resolve_login_tenant(text) TO oroaroma_runtime;
    GRANT EXECUTE ON FUNCTION public.resolve_refresh_tenant(text) TO oroaroma_runtime;
  END IF;
END
$$;
