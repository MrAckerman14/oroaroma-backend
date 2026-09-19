-- Rows created automatically for products that predated a non-primary branch made
-- an independent inventory look like a zero-stock copy of the primary catalog.
DELETE FROM public."InventoryPoolStock" AS stock
USING public."Branch" AS branch, public."Store" AS product
WHERE branch."defaultInventoryPoolId" = stock."poolId"
  AND product.id = stock."productId"
  AND branch."isPrimary" = false
  AND stock.stock = 0
  AND product."createdAt" < branch."createdAt"
  AND NOT EXISTS (
    SELECT 1
    FROM public."SaleDetail" AS detail
    WHERE detail."inventoryPoolId" = stock."poolId"
      AND detail."storeId" = stock."productId"
  );
