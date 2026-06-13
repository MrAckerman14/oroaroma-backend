-- AlterTable
ALTER TABLE "Store" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "InventoryReportDetail" ADD COLUMN "productDescription" TEXT;

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "description";
