CREATE TYPE "ExpenseType" AS ENUM ('EXPENSE', 'INCOME');

CREATE TABLE "ExpenseCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseControl" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "type" "ExpenseType" NOT NULL,
  "categoryId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExpenseControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "note" TEXT,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "totalIncome" DECIMAL(14,2) NOT NULL,
  "totalExpense" DECIMAL(14,2) NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExpenseReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseReportDetail" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "expenseReportId" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL,
  "income" DECIMAL(14,2) NOT NULL,
  "expense" DECIMAL(14,2) NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "ExpenseReportDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_tenantId_normalizedName_key" ON "ExpenseCategory"("tenantId", "normalizedName");
CREATE INDEX "ExpenseCategory_tenantId_deletedAt_idx" ON "ExpenseCategory"("tenantId", "deletedAt");
CREATE INDEX "ExpenseControl_tenantId_date_idx" ON "ExpenseControl"("tenantId", "date");
CREATE INDEX "ExpenseControl_tenantId_type_date_idx" ON "ExpenseControl"("tenantId", "type", "date");
CREATE INDEX "ExpenseControl_categoryId_idx" ON "ExpenseControl"("categoryId");
CREATE INDEX "ExpenseControl_createdById_idx" ON "ExpenseControl"("createdById");
CREATE INDEX "ExpenseControl_deletedAt_idx" ON "ExpenseControl"("deletedAt");
CREATE INDEX "ExpenseReport_tenantId_createdAt_idx" ON "ExpenseReport"("tenantId", "createdAt");
CREATE INDEX "ExpenseReport_createdById_idx" ON "ExpenseReport"("createdById");
CREATE INDEX "ExpenseReport_deletedAt_idx" ON "ExpenseReport"("deletedAt");
CREATE INDEX "ExpenseReportDetail_tenantId_idx" ON "ExpenseReportDetail"("tenantId");
CREATE INDEX "ExpenseReportDetail_expenseReportId_idx" ON "ExpenseReportDetail"("expenseReportId");

ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReportDetail" ADD CONSTRAINT "ExpenseReportDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReportDetail" ADD CONSTRAINT "ExpenseReportDetail_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "resource", "action", "scope") VALUES
  (gen_random_uuid()::text, 'expense-controls:create:global', 'expense-controls', 'create', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:read:global', 'expense-controls', 'read', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:update:global', 'expense-controls', 'update', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:delete:global', 'expense-controls', 'delete', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:export:global', 'expense-controls', 'export', 'GLOBAL')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."key" = 'admin' AND permission."resource" = 'expense-controls'
ON CONFLICT DO NOTHING;

INSERT INTO "ExpenseCategory" ("id", "tenantId", "name", "normalizedName", "isSystem", "updatedAt")
SELECT gen_random_uuid()::text, tenant."id", category.name, category.normalized_name, true, CURRENT_TIMESTAMP
FROM "Tenant" tenant
CROSS JOIN (VALUES
  ('Ventas', 'ventas'), ('Mensajería', 'mensajeria'), ('Mercancía', 'mercancia'),
  ('Publicidad', 'publicidad'), ('Nómina', 'nomina'), ('Local', 'local'), ('Acarreo', 'acarreo')
) AS category(name, normalized_name)
ON CONFLICT ("tenantId", "normalizedName") DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_expense_control_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE category_tenant TEXT; creator_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO category_tenant FROM "ExpenseCategory" WHERE "id" = NEW."categoryId" AND "deletedAt" IS NULL;
  SELECT "tenantId" INTO creator_tenant FROM "User" WHERE "id" = NEW."createdById" AND "deletedAt" IS NULL;
  IF category_tenant IS NULL OR creator_tenant IS NULL THEN RAISE EXCEPTION 'expense control references missing category or creator'; END IF;
  IF category_tenant <> creator_tenant THEN RAISE EXCEPTION 'expense control crosses tenant boundary'; END IF;
  NEW."tenantId" := creator_tenant;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_expense_report_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE creator_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO creator_tenant FROM "User" WHERE "id" = NEW."createdById" AND "deletedAt" IS NULL;
  IF creator_tenant IS NULL THEN RAISE EXCEPTION 'expense report references missing creator'; END IF;
  NEW."tenantId" := creator_tenant;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_expense_report_detail_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE report_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO report_tenant FROM "ExpenseReport" WHERE "id" = NEW."expenseReportId";
  IF report_tenant IS NULL THEN RAISE EXCEPTION 'expense report detail references missing report'; END IF;
  NEW."tenantId" := report_tenant;
  RETURN NEW;
END; $$;

CREATE TRIGGER "ExpenseControl_tenant_guard" BEFORE INSERT OR UPDATE OF "categoryId", "createdById", "tenantId" ON "ExpenseControl" FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_control_tenant();
CREATE TRIGGER "ExpenseReport_tenant_guard" BEFORE INSERT OR UPDATE OF "createdById", "tenantId" ON "ExpenseReport" FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_report_tenant();
CREATE TRIGGER "ExpenseReportDetail_tenant_guard" BEFORE INSERT OR UPDATE OF "expenseReportId", "tenantId" ON "ExpenseReportDetail" FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_report_detail_tenant();

ALTER TABLE "ExpenseCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseControl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseReportDetail" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ExpenseCategory_current_tenant" ON "ExpenseCategory" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "ExpenseControl_current_tenant" ON "ExpenseControl" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "ExpenseReport_current_tenant" ON "ExpenseReport" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "ExpenseReportDetail_current_tenant" ON "ExpenseReportDetail" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
