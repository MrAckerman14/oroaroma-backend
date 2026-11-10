CREATE TYPE "FiscalProvider" AS ENUM ('SIMULATED', 'ALANUBE');
CREATE TYPE "FiscalEnvironment" AS ENUM ('TEST', 'PRODUCTION');
CREATE TYPE "FiscalDocumentType" AS ENUM ('E31', 'E32', 'E33', 'E34');
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED', 'FAILED');

CREATE TABLE "TenantFiscalProfile" (
  "tenantId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "provider" "FiscalProvider" NOT NULL DEFAULT 'SIMULATED',
  "environment" "FiscalEnvironment" NOT NULL DEFAULT 'TEST',
  "rnc" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "address" TEXT NOT NULL,
  "municipality" TEXT,
  "province" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "economicActivity" TEXT,
  "providerCompanyId" TEXT,
  "providerTokenEncrypted" TEXT,
  "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
  "itbisRate" INTEGER NOT NULL DEFAULT 18,
  "autoIssueOnFinalize" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFiscalProfile_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantFiscalProfile_itbis_rate_check" CHECK ("itbisRate" IN (0, 16, 18))
);

CREATE TABLE "FiscalSequence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "documentType" "FiscalDocumentType" NOT NULL,
  "startNumber" INTEGER NOT NULL,
  "endNumber" INTEGER NOT NULL,
  "nextNumber" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalSequence_range_check" CHECK ("startNumber" >= 1 AND "endNumber" >= "startNumber" AND "endNumber" <= 9999999999 AND "nextNumber" >= "startNumber" AND "nextNumber" <= "endNumber" + 1)
);

CREATE TABLE "FiscalDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "saleId" TEXT,
  "referencedDocumentId" TEXT,
  "documentType" "FiscalDocumentType" NOT NULL,
  "encf" TEXT NOT NULL,
  "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "FiscalProvider" NOT NULL,
  "environment" "FiscalEnvironment" NOT NULL,
  "providerDocumentId" TEXT,
  "securityCode" TEXT,
  "signatureDate" TIMESTAMP(3),
  "stampDate" TIMESTAMP(3) NOT NULL,
  "stampUrl" TEXT,
  "pdfUrl" TEXT,
  "xmlUrl" TEXT,
  "buyerRnc" TEXT,
  "buyerName" TEXT,
  "buyerEmail" TEXT,
  "taxedAmount" DECIMAL(14,2) NOT NULL,
  "exemptAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "itbisAmount" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "modificationCode" INTEGER,
  "reason" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB NOT NULL,
  "providerResponse" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "issuedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalSequence_tenantId_documentType_startNumber_key" ON "FiscalSequence"("tenantId", "documentType", "startNumber");
CREATE INDEX "FiscalSequence_tenantId_documentType_active_idx" ON "FiscalSequence"("tenantId", "documentType", "active");
CREATE UNIQUE INDEX "FiscalDocument_tenantId_encf_key" ON "FiscalDocument"("tenantId", "encf");
CREATE INDEX "FiscalDocument_tenantId_createdAt_idx" ON "FiscalDocument"("tenantId", "createdAt");
CREATE INDEX "FiscalDocument_tenantId_saleId_idx" ON "FiscalDocument"("tenantId", "saleId");
CREATE INDEX "FiscalDocument_tenantId_status_idx" ON "FiscalDocument"("tenantId", "status");
CREATE INDEX "FiscalDocument_referencedDocumentId_idx" ON "FiscalDocument"("referencedDocumentId");

ALTER TABLE "TenantFiscalProfile" ADD CONSTRAINT "TenantFiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalSequence" ADD CONSTRAINT "FiscalSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_referencedDocumentId_fkey" FOREIGN KEY ("referencedDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La empresa del documento siempre es la de la venta y la del documento al que hace referencia.
CREATE OR REPLACE FUNCTION public.enforce_fiscal_document_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_tenant TEXT; reference_tenant TEXT;
BEGIN
  IF NEW."saleId" IS NOT NULL THEN
    SELECT "tenantId" INTO sale_tenant FROM "Sale" WHERE "id" = NEW."saleId";
    IF sale_tenant IS NULL OR sale_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'fiscal document crosses tenant boundary (sale)'; END IF;
  END IF;
  IF NEW."referencedDocumentId" IS NOT NULL THEN
    SELECT "tenantId" INTO reference_tenant FROM "FiscalDocument" WHERE "id" = NEW."referencedDocumentId";
    IF reference_tenant IS NULL OR reference_tenant <> NEW."tenantId" THEN RAISE EXCEPTION 'fiscal document crosses tenant boundary (reference)'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "FiscalDocument_tenant_guard" BEFORE INSERT OR UPDATE OF "saleId", "referencedDocumentId", "tenantId" ON "FiscalDocument" FOR EACH ROW EXECUTE FUNCTION public.enforce_fiscal_document_tenant();

ALTER TABLE "TenantFiscalProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TenantFiscalProfile_current_tenant" ON "TenantFiscalProfile" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "FiscalSequence_current_tenant" ON "FiscalSequence" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "FiscalDocument_current_tenant" ON "FiscalDocument" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oroaroma_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."TenantFiscalProfile", public."FiscalSequence", public."FiscalDocument" TO oroaroma_runtime;
  END IF;
END $$;

INSERT INTO "Permission" ("id", "key", "resource", "action", "scope") VALUES
  (gen_random_uuid()::text, 'fiscal-documents:read:global', 'fiscal-documents', 'read', 'GLOBAL'),
  (gen_random_uuid()::text, 'fiscal-documents:create:global', 'fiscal-documents', 'create', 'GLOBAL'),
  (gen_random_uuid()::text, 'fiscal-documents:void:global', 'fiscal-documents', 'void', 'GLOBAL'),
  (gen_random_uuid()::text, 'fiscal-documents:update:global', 'fiscal-documents', 'update', 'GLOBAL')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" = 'admin' AND p."resource" = 'fiscal-documents'
ON CONFLICT DO NOTHING;

INSERT INTO "ModuleCatalog" ("key", "name", "description", "defaultEnabled", "updatedAt") VALUES
  ('e-invoicing', 'Facturación electrónica', 'Comprobantes fiscales electrónicos (e-CF) ante la DGII', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "TenantModuleSetting" ("tenantId", "moduleKey", "enabled", "updatedAt")
SELECT tenant."id", 'e-invoicing', true, CURRENT_TIMESTAMP FROM "Tenant" tenant
ON CONFLICT ("tenantId", "moduleKey") DO NOTHING;
