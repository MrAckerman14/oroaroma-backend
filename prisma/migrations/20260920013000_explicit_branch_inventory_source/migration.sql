ALTER TABLE public."Branch"
  ADD COLUMN "sourceInventoryBranchId" TEXT;

UPDATE public."Branch" target
SET "sourceInventoryBranchId" = source."id"
FROM public."Branch" source
JOIN public."InventoryPool" pool
  ON pool."id" = source."defaultInventoryPoolId"
 AND pool."normalizedName" = 'branch-' || source."id"
WHERE target."defaultInventoryPoolId" = source."defaultInventoryPoolId"
  AND target."id" <> source."id"
  AND source."tenantId" = target."tenantId"
  AND NOT EXISTS (
    SELECT 1
    FROM public."BranchInventoryProductOverride" override
    WHERE override."branchId" = target."id"
  );

CREATE INDEX "Branch_sourceInventoryBranchId_idx"
  ON public."Branch"("sourceInventoryBranchId");

ALTER TABLE public."Branch"
  ADD CONSTRAINT "Branch_sourceInventoryBranchId_fkey"
  FOREIGN KEY ("sourceInventoryBranchId") REFERENCES public."Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."Branch"
  ADD CONSTRAINT "Branch_inventory_source_not_self"
  CHECK ("sourceInventoryBranchId" IS NULL OR "sourceInventoryBranchId" <> "id");

CREATE OR REPLACE FUNCTION public.enforce_branch_inventory_source_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."sourceInventoryBranchId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public."Branch" source
    WHERE source."id" = NEW."sourceInventoryBranchId"
      AND source."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'branch inventory source crosses tenant boundary' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Branch_inventory_source_tenant_guard"
BEFORE INSERT OR UPDATE OF "sourceInventoryBranchId", "tenantId" ON public."Branch"
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_inventory_source_tenant();
