-- A sale can appear in multiple cash closures because closures are repeatable snapshots.
DROP INDEX IF EXISTS "CashClosureDetail_saleId_key";

CREATE INDEX IF NOT EXISTS "CashClosureDetail_saleId_idx" ON "CashClosureDetail"("saleId");
