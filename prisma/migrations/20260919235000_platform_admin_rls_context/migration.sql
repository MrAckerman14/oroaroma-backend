CREATE OR REPLACE FUNCTION public.can_access_tenant(row_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT row_tenant_id = public.current_tenant_id()
    OR current_setting('app.platform_admin', true) = 'true'
$$;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT DISTINCT p.tablename, p.policyname
    FROM pg_policies p
    JOIN pg_class c ON c.relname = p.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenantId' AND NOT a.attisdropped
    WHERE p.schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (public.can_access_tenant("tenantId")) WITH CHECK (public.can_access_tenant("tenantId"))',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

ALTER POLICY "Tenant_current_tenant" ON public."Tenant"
  USING (public.can_access_tenant(id))
  WITH CHECK (public.can_access_tenant(id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oroaroma_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.can_access_tenant(text) TO oroaroma_runtime;
  END IF;
END
$$;
