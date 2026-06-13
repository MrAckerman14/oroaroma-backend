-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'STORE', 'OWN', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DELIVERY_PENDING', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'MIXED');

-- CreateEnum
CREATE TYPE "CashClosureStatus" AS ENUM ('PENDING', 'VERIFIED', 'VOIDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'GLOBAL',
    "storeId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "messengerId" TEXT,
    "sellerId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "amountCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountTransfer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "deliveryPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "perfumeCount" INTEGER NOT NULL,
    "phone" TEXT,
    "description" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'DELIVERY_PENDING',
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDetail" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosure" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "totalCash" DECIMAL(12,2) NOT NULL,
    "totalTransfer" DECIMAL(12,2) NOT NULL,
    "totalSale" DECIMAL(12,2) NOT NULL,
    "totalMessengerCost" DECIMAL(12,2) NOT NULL,
    "netTotal" DECIMAL(12,2) NOT NULL,
    "totalPerfumes" INTEGER NOT NULL,
    "status" "CashClosureStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosureDetail" (
    "id" TEXT NOT NULL,
    "closureId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,

    CONSTRAINT "CashClosureDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReport" (
    "id" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "totalProducts" INTEGER NOT NULL,
    "totalInventoryValue" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReportDetail" (
    "id" TEXT NOT NULL,
    "inventoryReportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "inventoryValue" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InventoryReportDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_resource_action_idx" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_scope_key" ON "Permission"("resource", "action", "scope");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_scope_storeId_idx" ON "UserRoleAssignment"("scope", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Store_deletedAt_idx" ON "Store"("deletedAt");

-- CreateIndex
CREATE INDEX "Store_name_idx" ON "Store"("name");

-- CreateIndex
CREATE INDEX "Sale_employeeId_idx" ON "Sale"("employeeId");

-- CreateIndex
CREATE INDEX "Sale_messengerId_idx" ON "Sale"("messengerId");

-- CreateIndex
CREATE INDEX "Sale_sellerId_idx" ON "Sale"("sellerId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_deletedAt_idx" ON "Sale"("deletedAt");

-- CreateIndex
CREATE INDEX "SaleDetail_saleId_idx" ON "SaleDetail"("saleId");

-- CreateIndex
CREATE INDEX "SaleDetail_storeId_idx" ON "SaleDetail"("storeId");

-- CreateIndex
CREATE INDEX "CashClosure_createdById_idx" ON "CashClosure"("createdById");

-- CreateIndex
CREATE INDEX "CashClosure_fromDate_toDate_idx" ON "CashClosure"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "CashClosure_status_idx" ON "CashClosure"("status");

-- CreateIndex
CREATE INDEX "CashClosureDetail_saleId_idx" ON "CashClosureDetail"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosureDetail_closureId_saleId_key" ON "CashClosureDetail"("closureId", "saleId");

-- CreateIndex
CREATE INDEX "InventoryReport_createdById_idx" ON "InventoryReport"("createdById");

-- CreateIndex
CREATE INDEX "InventoryReport_createdAt_idx" ON "InventoryReport"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryReportDetail_inventoryReportId_idx" ON "InventoryReportDetail"("inventoryReportId");

-- CreateIndex
CREATE INDEX "InventoryReportDetail_productId_idx" ON "InventoryReportDetail"("productId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_messengerId_fkey" FOREIGN KEY ("messengerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDetail" ADD CONSTRAINT "SaleDetail_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDetail" ADD CONSTRAINT "SaleDetail_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosureDetail" ADD CONSTRAINT "CashClosureDetail_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "CashClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosureDetail" ADD CONSTRAINT "CashClosureDetail_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReport" ADD CONSTRAINT "InventoryReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReportDetail" ADD CONSTRAINT "InventoryReportDetail_inventoryReportId_fkey" FOREIGN KEY ("inventoryReportId") REFERENCES "InventoryReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReportDetail" ADD CONSTRAINT "InventoryReportDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
