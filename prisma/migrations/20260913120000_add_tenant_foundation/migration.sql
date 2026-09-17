-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Bootstrap tenant for the current single-company deployment.
INSERT INTO "Tenant" ("id", "slug", "name", "status", "createdAt", "updatedAt")
VALUES ('default', 'default', 'Oro Aroma', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Add tenant columns with a safe compatibility default.
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Role" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "UserRoleAssignment" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "RefreshSession" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Store" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Sale" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "SaleDetail" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CashClosure" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CashClosureDetail" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "InventoryReport" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "InventoryReportDetail" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_tenantId_email_idx" ON "User"("tenantId", "email");
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");
CREATE INDEX "UserRoleAssignment_tenantId_idx" ON "UserRoleAssignment"("tenantId");
CREATE INDEX "RefreshSession_tenantId_idx" ON "RefreshSession"("tenantId");
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenantId");
CREATE INDEX "Store_tenantId_name_idx" ON "Store"("tenantId", "name");
CREATE INDEX "Sale_tenantId_idx" ON "Sale"("tenantId");
CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");
CREATE INDEX "SaleDetail_tenantId_idx" ON "SaleDetail"("tenantId");
CREATE INDEX "CashClosure_tenantId_idx" ON "CashClosure"("tenantId");
CREATE INDEX "CashClosure_tenantId_fromDate_toDate_idx" ON "CashClosure"("tenantId", "fromDate", "toDate");
CREATE INDEX "CashClosureDetail_tenantId_idx" ON "CashClosureDetail"("tenantId");
CREATE INDEX "InventoryReport_tenantId_idx" ON "InventoryReport"("tenantId");
CREATE INDEX "InventoryReport_tenantId_createdAt_idx" ON "InventoryReport"("tenantId", "createdAt");
CREATE INDEX "InventoryReportDetail_tenantId_idx" ON "InventoryReportDetail"("tenantId");
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleDetail" ADD CONSTRAINT "SaleDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosureDetail" ADD CONSTRAINT "CashClosureDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReport" ADD CONSTRAINT "InventoryReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReportDetail" ADD CONSTRAINT "InventoryReportDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_role_assignment_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  user_tenant TEXT;
  role_tenant TEXT;
  store_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO user_tenant FROM "User" WHERE "id" = NEW."userId";
  SELECT "tenantId" INTO role_tenant FROM "Role" WHERE "id" = NEW."roleId";

  IF user_tenant IS NULL OR role_tenant IS NULL THEN
    RAISE EXCEPTION 'user role assignment references missing user or role';
  END IF;

  IF user_tenant <> role_tenant THEN
    RAISE EXCEPTION 'user role assignment crosses tenant boundary';
  END IF;

  IF NEW."storeId" IS NOT NULL THEN
    SELECT "tenantId" INTO store_tenant FROM "Store" WHERE "id" = NEW."storeId";
    IF store_tenant IS NULL OR store_tenant <> user_tenant THEN
      RAISE EXCEPTION 'user role assignment store crosses tenant boundary';
    END IF;
  END IF;

  NEW."tenantId" := user_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_refresh_session_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  user_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO user_tenant FROM "User" WHERE "id" = NEW."userId";
  IF user_tenant IS NULL THEN
    RAISE EXCEPTION 'refresh session references missing user';
  END IF;

  NEW."tenantId" := user_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_sale_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_tenant TEXT;
  messenger_tenant TEXT;
  seller_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO employee_tenant FROM "User" WHERE "id" = NEW."employeeId";
  IF employee_tenant IS NULL THEN
    RAISE EXCEPTION 'sale references missing employee';
  END IF;

  IF NEW."messengerId" IS NOT NULL THEN
    SELECT "tenantId" INTO messenger_tenant FROM "User" WHERE "id" = NEW."messengerId";
    IF messenger_tenant IS NULL OR messenger_tenant <> employee_tenant THEN
      RAISE EXCEPTION 'sale messenger crosses tenant boundary';
    END IF;
  END IF;

  IF NEW."sellerId" IS NOT NULL THEN
    SELECT "tenantId" INTO seller_tenant FROM "User" WHERE "id" = NEW."sellerId";
    IF seller_tenant IS NULL OR seller_tenant <> employee_tenant THEN
      RAISE EXCEPTION 'sale seller crosses tenant boundary';
    END IF;
  END IF;

  NEW."tenantId" := employee_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_sale_detail_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sale_tenant TEXT;
  store_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO sale_tenant FROM "Sale" WHERE "id" = NEW."saleId";
  SELECT "tenantId" INTO store_tenant FROM "Store" WHERE "id" = NEW."storeId";

  IF sale_tenant IS NULL OR store_tenant IS NULL THEN
    RAISE EXCEPTION 'sale detail references missing sale or store';
  END IF;

  IF sale_tenant <> store_tenant THEN
    RAISE EXCEPTION 'sale detail crosses tenant boundary';
  END IF;

  NEW."tenantId" := sale_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cash_closure_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  creator_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO creator_tenant FROM "User" WHERE "id" = NEW."createdById";
  IF creator_tenant IS NULL THEN
    RAISE EXCEPTION 'cash closure references missing creator';
  END IF;

  NEW."tenantId" := creator_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cash_closure_detail_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  closure_tenant TEXT;
  sale_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO closure_tenant FROM "CashClosure" WHERE "id" = NEW."closureId";
  SELECT "tenantId" INTO sale_tenant FROM "Sale" WHERE "id" = NEW."saleId";

  IF closure_tenant IS NULL OR sale_tenant IS NULL THEN
    RAISE EXCEPTION 'cash closure detail references missing closure or sale';
  END IF;

  IF closure_tenant <> sale_tenant THEN
    RAISE EXCEPTION 'cash closure detail crosses tenant boundary';
  END IF;

  NEW."tenantId" := closure_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_report_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  creator_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO creator_tenant FROM "User" WHERE "id" = NEW."createdById";
  IF creator_tenant IS NULL THEN
    RAISE EXCEPTION 'inventory report references missing creator';
  END IF;

  NEW."tenantId" := creator_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_report_detail_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  report_tenant TEXT;
  product_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO report_tenant FROM "InventoryReport" WHERE "id" = NEW."inventoryReportId";
  SELECT "tenantId" INTO product_tenant FROM "Store" WHERE "id" = NEW."productId";

  IF report_tenant IS NULL OR product_tenant IS NULL THEN
    RAISE EXCEPTION 'inventory report detail references missing report or product';
  END IF;

  IF report_tenant <> product_tenant THEN
    RAISE EXCEPTION 'inventory report detail crosses tenant boundary';
  END IF;

  NEW."tenantId" := report_tenant;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_audit_log_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_tenant TEXT;
BEGIN
  IF NEW."actorId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "tenantId" INTO actor_tenant FROM "User" WHERE "id" = NEW."actorId";
  IF actor_tenant IS NULL THEN
    RAISE EXCEPTION 'audit log references missing actor';
  END IF;

  NEW."tenantId" := actor_tenant;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "UserRoleAssignment_tenant_guard"
BEFORE INSERT OR UPDATE OF "userId", "roleId", "storeId", "tenantId" ON "UserRoleAssignment"
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_assignment_tenant();

CREATE TRIGGER "RefreshSession_tenant_guard"
BEFORE INSERT OR UPDATE OF "userId", "tenantId" ON "RefreshSession"
FOR EACH ROW EXECUTE FUNCTION public.enforce_refresh_session_tenant();

CREATE TRIGGER "Sale_tenant_guard"
BEFORE INSERT OR UPDATE OF "employeeId", "messengerId", "sellerId", "tenantId" ON "Sale"
FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_tenant();

CREATE TRIGGER "SaleDetail_tenant_guard"
BEFORE INSERT OR UPDATE OF "saleId", "storeId", "tenantId" ON "SaleDetail"
FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_detail_tenant();

CREATE TRIGGER "CashClosure_tenant_guard"
BEFORE INSERT OR UPDATE OF "createdById", "tenantId" ON "CashClosure"
FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_closure_tenant();

CREATE TRIGGER "CashClosureDetail_tenant_guard"
BEFORE INSERT OR UPDATE OF "closureId", "saleId", "tenantId" ON "CashClosureDetail"
FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_closure_detail_tenant();

CREATE TRIGGER "InventoryReport_tenant_guard"
BEFORE INSERT OR UPDATE OF "createdById", "tenantId" ON "InventoryReport"
FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_report_tenant();

CREATE TRIGGER "InventoryReportDetail_tenant_guard"
BEFORE INSERT OR UPDATE OF "inventoryReportId", "productId", "tenantId" ON "InventoryReportDetail"
FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_report_detail_tenant();

CREATE TRIGGER "AuditLog_tenant_guard"
BEFORE INSERT OR UPDATE OF "actorId", "tenantId" ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_log_tenant();

-- Row Level Security policies for non-owner database roles. Do not FORCE yet:
-- existing deployment users may own these tables. Testing will run RLS through
-- a restricted role before production hardening.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashClosure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashClosureDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryReportDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant_current_tenant" ON "Tenant"
USING ("id" = public.current_tenant_id())
WITH CHECK ("id" = public.current_tenant_id());

CREATE POLICY "User_current_tenant" ON "User"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "Role_current_tenant" ON "Role"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "UserRoleAssignment_current_tenant" ON "UserRoleAssignment"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "RefreshSession_current_tenant" ON "RefreshSession"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "Store_current_tenant" ON "Store"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "Sale_current_tenant" ON "Sale"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "SaleDetail_current_tenant" ON "SaleDetail"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "CashClosure_current_tenant" ON "CashClosure"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "CashClosureDetail_current_tenant" ON "CashClosureDetail"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "InventoryReport_current_tenant" ON "InventoryReport"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "InventoryReportDetail_current_tenant" ON "InventoryReportDetail"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());

CREATE POLICY "AuditLog_current_tenant" ON "AuditLog"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());
