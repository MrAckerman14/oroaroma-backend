CREATE TABLE "InventoryPool" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InventoryPool_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InventoryPoolStock" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "poolId" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "stock" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryPoolStock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryPoolStock_nonnegative" CHECK ("stock" >= 0)
);
CREATE TABLE "BranchInventoryProductOverride" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "poolId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BranchInventoryProductOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryPool_tenantId_normalizedName_key" ON "InventoryPool"("tenantId", "normalizedName");
CREATE INDEX "InventoryPool_tenantId_idx" ON "InventoryPool"("tenantId");
CREATE UNIQUE INDEX "InventoryPoolStock_poolId_productId_key" ON "InventoryPoolStock"("poolId", "productId");
CREATE INDEX "InventoryPoolStock_tenantId_productId_idx" ON "InventoryPoolStock"("tenantId", "productId");
CREATE UNIQUE INDEX "BranchInventoryProductOverride_branchId_productId_key" ON "BranchInventoryProductOverride"("branchId", "productId");
CREATE INDEX "BranchInventoryProductOverride_tenantId_poolId_idx" ON "BranchInventoryProductOverride"("tenantId", "poolId");

ALTER TABLE "InventoryPool" ADD CONSTRAINT "InventoryPool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryPoolStock" ADD CONSTRAINT "InventoryPoolStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryPoolStock" ADD CONSTRAINT "InventoryPoolStock_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryPoolStock" ADD CONSTRAINT "InventoryPoolStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchInventoryProductOverride" ADD CONSTRAINT "BranchInventoryProductOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchInventoryProductOverride" ADD CONSTRAINT "BranchInventoryProductOverride_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchInventoryProductOverride" ADD CONSTRAINT "BranchInventoryProductOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchInventoryProductOverride" ADD CONSTRAINT "BranchInventoryProductOverride_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InventoryPool" ("id", "tenantId", "name", "normalizedName", "updatedAt")
SELECT gen_random_uuid()::text, b."tenantId", 'Inventario ' || b."name", 'branch-' || b."id", CURRENT_TIMESTAMP FROM "Branch" b;
ALTER TABLE "Branch" ADD COLUMN "defaultInventoryPoolId" TEXT;
UPDATE "Branch" b SET "defaultInventoryPoolId" = p."id" FROM "InventoryPool" p WHERE p."tenantId" = b."tenantId" AND p."normalizedName" = 'branch-' || b."id";
ALTER TABLE "Branch" ALTER COLUMN "defaultInventoryPoolId" SET NOT NULL;
CREATE INDEX "Branch_defaultInventoryPoolId_idx" ON "Branch"("defaultInventoryPoolId");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_defaultInventoryPoolId_fkey" FOREIGN KEY ("defaultInventoryPoolId") REFERENCES "InventoryPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "InventoryPoolStock" ("id", "tenantId", "poolId", "productId", "stock", "updatedAt")
SELECT gen_random_uuid()::text, b."tenantId", b."defaultInventoryPoolId", s."id",
  CASE WHEN b."isPrimary" THEN s."stock" ELSE 0 END, CURRENT_TIMESTAMP
FROM "Branch" b JOIN "Store" s ON s."tenantId" = b."tenantId";

ALTER TABLE "Sale" ADD COLUMN "branchId" TEXT;
ALTER TABLE "CashClosure" ADD COLUMN "branchId" TEXT;
ALTER TABLE "InventoryReport" ADD COLUMN "branchId" TEXT;
ALTER TABLE "ExpenseControl" ADD COLUMN "branchId" TEXT;
ALTER TABLE "ExpenseReport" ADD COLUMN "branchId" TEXT;
ALTER TABLE "SaleDetail" ADD COLUMN "inventoryPoolId" TEXT;

UPDATE "Sale" x SET "branchId" = b."id" FROM "Branch" b WHERE b."tenantId" = x."tenantId" AND b."isPrimary";
UPDATE "CashClosure" x SET "branchId" = b."id" FROM "Branch" b WHERE b."tenantId" = x."tenantId" AND b."isPrimary";
UPDATE "InventoryReport" x SET "branchId" = b."id" FROM "Branch" b WHERE b."tenantId" = x."tenantId" AND b."isPrimary";
UPDATE "ExpenseControl" x SET "branchId" = b."id" FROM "Branch" b WHERE b."tenantId" = x."tenantId" AND b."isPrimary";
UPDATE "ExpenseReport" x SET "branchId" = b."id" FROM "Branch" b WHERE b."tenantId" = x."tenantId" AND b."isPrimary";
UPDATE "SaleDetail" d SET "inventoryPoolId" = b."defaultInventoryPoolId" FROM "Branch" b JOIN "Sale" s ON s."branchId" = b."id" WHERE d."saleId" = s."id";

ALTER TABLE "Sale" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "CashClosure" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "InventoryReport" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "ExpenseControl" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "ExpenseReport" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "SaleDetail" ALTER COLUMN "inventoryPoolId" SET NOT NULL;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReport" ADD CONSTRAINT "InventoryReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleDetail" ADD CONSTRAINT "SaleDetail_inventoryPoolId_fkey" FOREIGN KEY ("inventoryPoolId") REFERENCES "InventoryPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Sale_tenantId_branchId_createdAt_idx" ON "Sale"("tenantId", "branchId", "createdAt");
CREATE INDEX "CashClosure_tenantId_branchId_fromDate_toDate_idx" ON "CashClosure"("tenantId", "branchId", "fromDate", "toDate");
CREATE INDEX "InventoryReport_tenantId_branchId_createdAt_idx" ON "InventoryReport"("tenantId", "branchId", "createdAt");
CREATE INDEX "ExpenseControl_tenantId_branchId_date_idx" ON "ExpenseControl"("tenantId", "branchId", "date");
CREATE INDEX "ExpenseReport_tenantId_branchId_createdAt_idx" ON "ExpenseReport"("tenantId", "branchId", "createdAt");
CREATE INDEX "SaleDetail_inventoryPoolId_idx" ON "SaleDetail"("inventoryPoolId");

ALTER TABLE "InventoryPool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryPoolStock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchInventoryProductOverride" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "InventoryPool_current_tenant" ON "InventoryPool" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "InventoryPoolStock_current_tenant" ON "InventoryPoolStock" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "BranchInventoryProductOverride_current_tenant" ON "BranchInventoryProductOverride" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
