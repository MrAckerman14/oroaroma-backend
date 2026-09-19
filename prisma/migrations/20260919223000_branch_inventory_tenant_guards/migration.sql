CREATE OR REPLACE FUNCTION public.enforce_branch_owned_record_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO branch_tenant FROM public."Branch" WHERE "id" = NEW."branchId";
  IF branch_tenant IS NULL OR branch_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'branch-owned record crosses tenant boundary'; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "Sale_branch_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "tenantId" ON "Sale" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_owned_record_tenant();
CREATE TRIGGER "CashClosure_branch_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "tenantId" ON "CashClosure" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_owned_record_tenant();
CREATE TRIGGER "InventoryReport_branch_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "tenantId" ON "InventoryReport" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_owned_record_tenant();
CREATE TRIGGER "ExpenseControl_branch_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "tenantId" ON "ExpenseControl" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_owned_record_tenant();
CREATE TRIGGER "ExpenseReport_branch_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "tenantId" ON "ExpenseReport" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_owned_record_tenant();

CREATE OR REPLACE FUNCTION public.enforce_inventory_stock_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pool_tenant TEXT; product_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO pool_tenant FROM public."InventoryPool" WHERE "id" = NEW."poolId";
  SELECT "tenantId" INTO product_tenant FROM public."Store" WHERE "id" = NEW."productId";
  IF pool_tenant IS NULL OR product_tenant IS NULL OR pool_tenant <> product_tenant OR pool_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'inventory stock crosses tenant boundary'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "InventoryPoolStock_tenant_guard" BEFORE INSERT OR UPDATE OF "poolId", "productId", "tenantId" ON "InventoryPoolStock" FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_stock_tenant();

CREATE OR REPLACE FUNCTION public.enforce_inventory_override_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_tenant TEXT; pool_tenant TEXT; product_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO branch_tenant FROM public."Branch" WHERE "id" = NEW."branchId";
  SELECT "tenantId" INTO pool_tenant FROM public."InventoryPool" WHERE "id" = NEW."poolId";
  SELECT "tenantId" INTO product_tenant FROM public."Store" WHERE "id" = NEW."productId";
  IF branch_tenant IS NULL OR pool_tenant IS NULL OR product_tenant IS NULL OR branch_tenant <> pool_tenant OR branch_tenant <> product_tenant OR branch_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'inventory override crosses tenant boundary'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "BranchInventoryProductOverride_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "poolId", "productId", "tenantId" ON "BranchInventoryProductOverride" FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_override_tenant();

CREATE OR REPLACE FUNCTION public.enforce_sale_detail_inventory_pool_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pool_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO pool_tenant FROM public."InventoryPool" WHERE "id" = NEW."inventoryPoolId";
  IF pool_tenant IS NULL OR pool_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'sale detail inventory pool crosses tenant boundary'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "SaleDetail_inventory_pool_tenant_guard" BEFORE INSERT OR UPDATE OF "inventoryPoolId", "tenantId" ON "SaleDetail" FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_detail_inventory_pool_tenant();
