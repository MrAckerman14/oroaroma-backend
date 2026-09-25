DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oroaroma_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Warehouse" TO oroaroma_runtime;
    GRANT SELECT, INSERT ON TABLE public."InventoryTransfer", public."InventoryTransferItem" TO oroaroma_runtime;
  END IF;
END $$;
