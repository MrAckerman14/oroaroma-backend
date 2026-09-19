CREATE TABLE "BranchProductExclusion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchProductExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchProductExclusion_branchId_productId_key"
  ON "BranchProductExclusion"("branchId", "productId");
CREATE INDEX "BranchProductExclusion_tenantId_productId_idx"
  ON "BranchProductExclusion"("tenantId", "productId");

ALTER TABLE "BranchProductExclusion"
  ADD CONSTRAINT "BranchProductExclusion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchProductExclusion"
  ADD CONSTRAINT "BranchProductExclusion_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchProductExclusion"
  ADD CONSTRAINT "BranchProductExclusion_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_branch_product_exclusion_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Branch" b WHERE b.id = NEW."branchId" AND b."tenantId" = NEW."tenantId")
     OR NOT EXISTS (SELECT 1 FROM public."Store" s WHERE s.id = NEW."productId" AND s."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'branch product exclusion tenant mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "BranchProductExclusion_tenant_guard"
BEFORE INSERT OR UPDATE ON "BranchProductExclusion"
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_product_exclusion_tenant();

ALTER TABLE "BranchProductExclusion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_branch_product_exclusion ON "BranchProductExclusion"
USING ("tenantId" = current_setting('app.tenant_id', true))
WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

CREATE OR REPLACE FUNCTION public.enforce_sale_operational_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE participant_id text;
BEGIN
  IF NEW."branchId" IS NULL OR NOT EXISTS (
    SELECT 1 FROM public."Branch" b
    WHERE b.id = NEW."branchId" AND b."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'sale branch tenant mismatch' USING ERRCODE = '23514';
  END IF;

  FOREACH participant_id IN ARRAY ARRAY[NEW."employeeId", NEW."messengerId", NEW."sellerId"] LOOP
    IF participant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public."User" u
      JOIN public."BranchMembership" bm ON bm."userId" = u.id
      WHERE u.id = participant_id
        AND u."tenantId" = NEW."tenantId"
        AND u.status = 'ACTIVE'
        AND u."deletedAt" IS NULL
        AND bm."tenantId" = NEW."tenantId"
        AND bm."branchId" = NEW."branchId"
    ) THEN
      RAISE EXCEPTION 'sale participant scope mismatch' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Sale_operational_scope_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "branchId", "employeeId", "messengerId", "sellerId" ON "Sale"
FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_operational_scope();

CREATE OR REPLACE FUNCTION public.enforce_sale_detail_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Sale" s WHERE s.id = NEW."saleId" AND s."tenantId" = NEW."tenantId")
     OR NOT EXISTS (SELECT 1 FROM public."Store" p WHERE p.id = NEW."storeId" AND p."tenantId" = NEW."tenantId")
     OR NEW."inventoryPoolId" IS NULL
     OR NOT EXISTS (SELECT 1 FROM public."InventoryPool" ip WHERE ip.id = NEW."inventoryPoolId" AND ip."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'sale detail tenant mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SaleDetail_scope_guard"
BEFORE INSERT OR UPDATE ON "SaleDetail"
FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_detail_scope();

CREATE OR REPLACE FUNCTION public.enforce_cash_closure_detail_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."CashClosure" c
    JOIN public."Sale" s ON s.id = NEW."saleId"
    WHERE c.id = NEW."closureId"
      AND c."tenantId" = NEW."tenantId"
      AND s."tenantId" = NEW."tenantId"
      AND s."branchId" = c."branchId"
  ) THEN
    RAISE EXCEPTION 'cash closure detail scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CashClosureDetail_scope_guard"
BEFORE INSERT OR UPDATE ON "CashClosureDetail"
FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_closure_detail_scope();
