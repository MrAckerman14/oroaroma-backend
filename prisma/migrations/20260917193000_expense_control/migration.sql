CREATE TYPE "ExpenseType" AS ENUM ('EXPENSE', 'INCOME');
CREATE TABLE "ExpenseCategory" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL, "isSystem" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ExpenseControl" ("id" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "type" "ExpenseType" NOT NULL, "categoryId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "description" TEXT, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "ExpenseControl_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ExpenseReport" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "note" TEXT, "fromDate" TIMESTAMP(3) NOT NULL, "toDate" TIMESTAMP(3) NOT NULL, "totalIncome" DECIMAL(14,2) NOT NULL, "totalExpense" DECIMAL(14,2) NOT NULL, "balance" DECIMAL(14,2) NOT NULL, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "ExpenseReport_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ExpenseReportDetail" ("id" TEXT NOT NULL, "expenseReportId" TEXT NOT NULL, "categoryName" TEXT NOT NULL, "income" DECIMAL(14,2) NOT NULL, "expense" DECIMAL(14,2) NOT NULL, "balance" DECIMAL(14,2) NOT NULL, CONSTRAINT "ExpenseReportDetail_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ExpenseCategory_normalizedName_key" ON "ExpenseCategory"("normalizedName");
CREATE INDEX "ExpenseCategory_deletedAt_idx" ON "ExpenseCategory"("deletedAt");
CREATE INDEX "ExpenseControl_date_idx" ON "ExpenseControl"("date");
CREATE INDEX "ExpenseControl_type_date_idx" ON "ExpenseControl"("type", "date");
CREATE INDEX "ExpenseControl_categoryId_idx" ON "ExpenseControl"("categoryId");
CREATE INDEX "ExpenseControl_createdById_idx" ON "ExpenseControl"("createdById");
CREATE INDEX "ExpenseControl_deletedAt_idx" ON "ExpenseControl"("deletedAt");
CREATE INDEX "ExpenseReport_createdAt_idx" ON "ExpenseReport"("createdAt");
CREATE INDEX "ExpenseReport_createdById_idx" ON "ExpenseReport"("createdById");
CREATE INDEX "ExpenseReport_deletedAt_idx" ON "ExpenseReport"("deletedAt");
CREATE INDEX "ExpenseReportDetail_expenseReportId_idx" ON "ExpenseReportDetail"("expenseReportId");
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseControl" ADD CONSTRAINT "ExpenseControl_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReportDetail" ADD CONSTRAINT "ExpenseReportDetail_expenseReportId_fkey" FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "Permission" ("id", "key", "resource", "action", "scope") VALUES
  (gen_random_uuid()::text, 'expense-controls:create:global', 'expense-controls', 'create', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:read:global', 'expense-controls', 'read', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:update:global', 'expense-controls', 'update', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:delete:global', 'expense-controls', 'delete', 'GLOBAL'),
  (gen_random_uuid()::text, 'expense-controls:export:global', 'expense-controls', 'export', 'GLOBAL')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT role."id", permission."id" FROM "Role" role CROSS JOIN "Permission" permission WHERE role."key" = 'admin' AND permission."resource" = 'expense-controls' ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" ("id", "name", "normalizedName", "isSystem", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Ventas', 'ventas', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Mensajería', 'mensajeria', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Mercancía', 'mercancia', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Publicidad', 'publicidad', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Nómina', 'nomina', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Local', 'local', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Acarreo', 'acarreo', true, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO NOTHING;
