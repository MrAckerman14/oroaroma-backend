-- One sale can belong to only one cash closure.
CREATE UNIQUE INDEX "CashClosureDetail_saleId_key" ON "CashClosureDetail"("saleId");
