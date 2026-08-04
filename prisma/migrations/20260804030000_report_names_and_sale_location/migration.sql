ALTER TABLE "Sale"
ADD COLUMN "locationUrl" TEXT;

ALTER TABLE "CashClosure"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Cierre de caja',
ADD COLUMN "note" TEXT;

UPDATE "CashClosure"
SET "name" = CONCAT(
  TO_CHAR("fromDate", 'YYYY-MM-DD'),
  ' - ',
  TO_CHAR("toDate", 'YYYY-MM-DD')
);

ALTER TABLE "InventoryReport"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Reporte de inventario',
ADD COLUMN "note" TEXT;
