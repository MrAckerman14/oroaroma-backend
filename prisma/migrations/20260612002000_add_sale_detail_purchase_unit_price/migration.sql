ALTER TABLE "SaleDetail"
ADD COLUMN "purchaseUnitPrice" DECIMAL(12,2);

UPDATE "SaleDetail" AS sd
SET "purchaseUnitPrice" = s."purchasePrice"
FROM "Store" AS s
WHERE sd."storeId" = s."id"
  AND sd."purchaseUnitPrice" IS NULL;

ALTER TABLE "SaleDetail"
ALTER COLUMN "purchaseUnitPrice" SET NOT NULL;
