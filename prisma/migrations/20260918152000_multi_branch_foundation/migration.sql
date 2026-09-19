CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL, "code" TEXT NOT NULL, "address" TEXT,
  "phone" TEXT, "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BranchMembership" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Branch_tenantId_normalizedName_key" ON "Branch"("tenantId", "normalizedName");
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");
CREATE INDEX "Branch_tenantId_status_idx" ON "Branch"("tenantId", "status");
CREATE UNIQUE INDEX "Branch_one_primary_per_tenant" ON "Branch"("tenantId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "BranchMembership_branchId_userId_key" ON "BranchMembership"("branchId", "userId");
CREATE INDEX "BranchMembership_tenantId_userId_idx" ON "BranchMembership"("tenantId", "userId");
CREATE INDEX "BranchMembership_userId_isPrimary_idx" ON "BranchMembership"("userId", "isPrimary");
CREATE UNIQUE INDEX "BranchMembership_one_primary_per_user" ON "BranchMembership"("tenantId", "userId") WHERE "isPrimary" = true;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Branch" ("id", "tenantId", "name", "normalizedName", "code", "isPrimary", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'Principal', 'principal', 'PRINCIPAL', true, CURRENT_TIMESTAMP FROM "Tenant" t;
INSERT INTO "BranchMembership" ("id", "tenantId", "branchId", "userId", "isPrimary")
SELECT gen_random_uuid()::text, u."tenantId", b."id", u."id", true FROM "User" u JOIN "Branch" b ON b."tenantId" = u."tenantId" AND b."isPrimary" = true WHERE u."deletedAt" IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_branch_membership_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE branch_tenant TEXT; user_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO branch_tenant FROM public."Branch" WHERE "id" = NEW."branchId";
  SELECT "tenantId" INTO user_tenant FROM public."User" WHERE "id" = NEW."userId" AND "deletedAt" IS NULL;
  IF branch_tenant IS NULL OR user_tenant IS NULL OR branch_tenant <> user_tenant THEN RAISE EXCEPTION 'branch membership crosses tenant boundary'; END IF;
  NEW."tenantId" := user_tenant; RETURN NEW;
END; $$;
CREATE TRIGGER "BranchMembership_tenant_guard" BEFORE INSERT OR UPDATE OF "branchId", "userId", "tenantId" ON "BranchMembership" FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_membership_tenant();

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchMembership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch_current_tenant" ON "Branch" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());
CREATE POLICY "BranchMembership_current_tenant" ON "BranchMembership" USING ("tenantId" = public.current_tenant_id()) WITH CHECK ("tenantId" = public.current_tenant_id());

INSERT INTO "Permission" ("id", "key", "resource", "action", "scope") VALUES
  (gen_random_uuid()::text, 'branches:create:global', 'branches', 'create', 'GLOBAL'),
  (gen_random_uuid()::text, 'branches:read:global', 'branches', 'read', 'GLOBAL'),
  (gen_random_uuid()::text, 'branches:update:global', 'branches', 'update', 'GLOBAL'),
  (gen_random_uuid()::text, 'branches:assign:global', 'branches', 'assign', 'GLOBAL')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."key" = 'admin' AND p."resource" = 'branches' ON CONFLICT DO NOTHING;
