DROP INDEX IF EXISTS "Role_key_key";
CREATE UNIQUE INDEX "Role_tenantId_key_key" ON "Role"("tenantId", "key");
