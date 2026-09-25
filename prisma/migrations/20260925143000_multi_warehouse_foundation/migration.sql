CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InventoryTransferStatus" AS ENUM ('COMPLETED');

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "inventoryPoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryTransfer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "sourceWarehouseId" TEXT NOT NULL,
  "destinationWarehouseId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "status" "InventoryTransferStatus" NOT NULL DEFAULT 'COMPLETED',
  "reference" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransfer_distinct_warehouses" CHECK ("sourceWarehouseId" <> "destinationWarehouseId")
);

CREATE TABLE "InventoryTransferItem" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "InventoryTransferItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransferItem_positive_quantity" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "Warehouse_inventoryPoolId_key" ON "Warehouse"("inventoryPoolId");
CREATE UNIQUE INDEX "Warehouse_branchId_normalizedName_key" ON "Warehouse"("branchId", "normalizedName");
CREATE UNIQUE INDEX "Warehouse_branchId_code_key" ON "Warehouse"("branchId", "code");
CREATE UNIQUE INDEX "Warehouse_one_default_per_branch" ON "Warehouse"("branchId") WHERE "isDefault";
CREATE INDEX "Warehouse_tenantId_branchId_status_idx" ON "Warehouse"("tenantId", "branchId", "status");
CREATE INDEX "InventoryTransfer_tenantId_branchId_createdAt_idx" ON "InventoryTransfer"("tenantId", "branchId", "createdAt");
CREATE INDEX "InventoryTransfer_sourceWarehouseId_createdAt_idx" ON "InventoryTransfer"("sourceWarehouseId", "createdAt");
CREATE INDEX "InventoryTransfer_destinationWarehouseId_createdAt_idx" ON "InventoryTransfer"("destinationWarehouseId", "createdAt");
CREATE UNIQUE INDEX "InventoryTransferItem_transferId_productId_key" ON "InventoryTransferItem"("transferId", "productId");
CREATE INDEX "InventoryTransferItem_productId_idx" ON "InventoryTransferItem"("productId");

ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_inventoryPoolId_fkey" FOREIGN KEY ("inventoryPoolId") REFERENCES "InventoryPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "InventoryTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Warehouse" ("id", "tenantId", "branchId", "inventoryPoolId", "name", "normalizedName", "code", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."tenantId", b."id", p."id", 'Principal', 'principal', 'PRINCIPAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Branch" b
JOIN "InventoryPool" p ON p."tenantId" = b."tenantId" AND p."normalizedName" = 'branch-' || b."id";

INSERT INTO "Warehouse" ("id", "tenantId", "branchId", "inventoryPoolId", "name", "normalizedName", "code", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."tenantId", b."id", b."defaultInventoryPoolId", 'Principal', 'principal', 'PRINCIPAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Branch" b
WHERE b."isPrimary" = true AND b."defaultInventoryPoolId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Warehouse" w WHERE w."branchId" = b."id")
  AND NOT EXISTS (SELECT 1 FROM "Warehouse" w WHERE w."inventoryPoolId" = b."defaultInventoryPoolId");

CREATE OR REPLACE FUNCTION public.enforce_warehouse_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_tenant TEXT; pool_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO branch_tenant FROM public."Branch" WHERE "id" = NEW."branchId";
  SELECT "tenantId" INTO pool_tenant FROM public."InventoryPool" WHERE "id" = NEW."inventoryPoolId";
  IF branch_tenant IS NULL OR pool_tenant IS NULL OR branch_tenant <> pool_tenant OR branch_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'warehouse crosses tenant boundary';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Warehouse_tenant_guard" BEFORE INSERT OR UPDATE OF "tenantId", "branchId", "inventoryPoolId" ON "Warehouse" FOR EACH ROW EXECUTE FUNCTION public.enforce_warehouse_tenant();

CREATE OR REPLACE FUNCTION public.enforce_inventory_transfer_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_tenant TEXT; source_tenant TEXT; destination_tenant TEXT; creator_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO branch_tenant FROM public."Branch" WHERE "id" = NEW."branchId";
  SELECT "tenantId" INTO source_tenant FROM public."Warehouse" WHERE "id" = NEW."sourceWarehouseId";
  SELECT "tenantId" INTO destination_tenant FROM public."Warehouse" WHERE "id" = NEW."destinationWarehouseId";
  SELECT "tenantId" INTO creator_tenant FROM public."User" WHERE "id" = NEW."createdById";
  IF branch_tenant IS NULL OR source_tenant IS NULL OR destination_tenant IS NULL OR creator_tenant IS NULL
     OR NEW."tenantId" <> branch_tenant OR NEW."tenantId" <> source_tenant
     OR NEW."tenantId" <> destination_tenant OR NEW."tenantId" <> creator_tenant THEN
    RAISE EXCEPTION 'inventory transfer crosses tenant boundary';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "InventoryTransfer_tenant_guard" BEFORE INSERT ON "InventoryTransfer" FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_transfer_tenant();

CREATE OR REPLACE FUNCTION public.enforce_inventory_transfer_item_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE transfer_tenant TEXT; product_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO transfer_tenant FROM public."InventoryTransfer" WHERE "id" = NEW."transferId";
  SELECT "tenantId" INTO product_tenant FROM public."Store" WHERE "id" = NEW."productId";
  IF transfer_tenant IS NULL OR product_tenant IS NULL OR transfer_tenant <> product_tenant THEN
    RAISE EXCEPTION 'inventory transfer item crosses tenant boundary';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "InventoryTransferItem_tenant_guard" BEFORE INSERT ON "InventoryTransferItem" FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_transfer_item_tenant();

CREATE OR REPLACE FUNCTION public.prevent_inventory_transfer_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = TG_RELID AND pg_get_userbyid(relowner) = current_user) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'completed inventory transfers are immutable';
END; $$;
CREATE TRIGGER "InventoryTransfer_immutable" BEFORE UPDATE OR DELETE ON "InventoryTransfer" FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_transfer_mutation();
CREATE TRIGGER "InventoryTransferItem_immutable" BEFORE UPDATE OR DELETE ON "InventoryTransferItem" FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_transfer_mutation();

ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransferItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouse_current_tenant" ON "Warehouse" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "InventoryTransfer_current_tenant" ON "InventoryTransfer" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "InventoryTransferItem_current_tenant" ON "InventoryTransferItem" USING (EXISTS (SELECT 1 FROM public."InventoryTransfer" t WHERE t."id" = "transferId" AND t."tenantId" = public.current_tenant_id())) WITH CHECK (EXISTS (SELECT 1 FROM public."InventoryTransfer" t WHERE t."id" = "transferId" AND t."tenantId" = public.current_tenant_id()));

INSERT INTO "Permission" ("id", "key", "resource", "action", "scope") VALUES
  (gen_random_uuid()::text, 'warehouses:create:global', 'warehouses', 'create', 'GLOBAL'),
  (gen_random_uuid()::text, 'warehouses:read:global', 'warehouses', 'read', 'GLOBAL'),
  (gen_random_uuid()::text, 'warehouses:read:assigned', 'warehouses', 'read', 'ASSIGNED'),
  (gen_random_uuid()::text, 'warehouses:update:global', 'warehouses', 'update', 'GLOBAL'),
  (gen_random_uuid()::text, 'warehouses:transfer:global', 'warehouses', 'transfer', 'GLOBAL'),
  (gen_random_uuid()::text, 'warehouses:transfer:assigned', 'warehouses', 'transfer', 'ASSIGNED')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" = 'admin' AND p."resource" = 'warehouses' ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."key" IN ('warehouses:read:assigned', 'warehouses:transfer:assigned')
WHERE r."key" = 'supervisor' ON CONFLICT DO NOTHING;
