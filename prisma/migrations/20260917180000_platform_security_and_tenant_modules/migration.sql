CREATE TABLE "PlatformPermission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRole" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "PlatformRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleCatalog" (
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleCatalog_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "TenantModuleSetting" (
  "tenantId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantModuleSetting_pkey" PRIMARY KEY ("tenantId", "moduleKey")
);

CREATE UNIQUE INDEX "PlatformPermission_key_key" ON "PlatformPermission"("key");
CREATE UNIQUE INDEX "PlatformPermission_resource_action_key" ON "PlatformPermission"("resource", "action");
CREATE UNIQUE INDEX "PlatformRole_key_key" ON "PlatformRole"("key");
CREATE UNIQUE INDEX "PlatformRoleAssignment_userId_roleId_key" ON "PlatformRoleAssignment"("userId", "roleId");
CREATE INDEX "PlatformRoleAssignment_userId_idx" ON "PlatformRoleAssignment"("userId");
CREATE INDEX "TenantModuleSetting_tenantId_enabled_idx" ON "TenantModuleSetting"("tenantId", "enabled");

ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PlatformPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantModuleSetting" ADD CONSTRAINT "TenantModuleSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantModuleSetting" ADD CONSTRAINT "TenantModuleSetting_moduleKey_fkey" FOREIGN KEY ("moduleKey") REFERENCES "ModuleCatalog"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "PlatformPermission" ("id", "key", "resource", "action", "description") VALUES
  ('platform-permission-tenants-read', 'platform:tenants:read', 'tenants', 'read', 'Consultar empresas'),
  ('platform-permission-tenants-create', 'platform:tenants:create', 'tenants', 'create', 'Crear empresas'),
  ('platform-permission-tenants-update', 'platform:tenants:update', 'tenants', 'update', 'Cambiar el estado de empresas'),
  ('platform-permission-modules-manage', 'platform:modules:manage', 'modules', 'manage', 'Configurar módulos por empresa'),
  ('platform-permission-security-read', 'platform:security:read', 'security', 'read', 'Consultar la configuración de seguridad')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlatformRole" ("id", "key", "name", "description", "isSystem", "updatedAt")
VALUES ('platform-role-owner', 'platform-owner', 'Propietario de plataforma', 'Control administrativo de la plataforma SaaS', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT 'platform-role-owner', "id" FROM "PlatformPermission"
ON CONFLICT DO NOTHING;

INSERT INTO "PlatformRoleAssignment" ("id", "userId", "roleId")
SELECT 'platform-owner-default', "id", 'platform-role-owner'
FROM "User"
WHERE lower("email") = 'admin@oroaroma.local'
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "ModuleCatalog" ("key", "name", "description", "defaultEnabled", "updatedAt") VALUES
  ('sales', 'Ventas', 'Registro y seguimiento de ventas', true, CURRENT_TIMESTAMP),
  ('users', 'Usuarios', 'Vendedores, colaboradores y asignaciones', true, CURRENT_TIMESTAMP),
  ('messengers', 'Mensajería', 'Mensajeros y entregas', true, CURRENT_TIMESTAMP),
  ('inventory', 'Almacén', 'Productos y existencias', true, CURRENT_TIMESTAMP),
  ('cash-closures', 'Cierres de caja', 'Cierres y conciliación de caja', true, CURRENT_TIMESTAMP),
  ('inventory-reports', 'Reportes de inventario', 'Reportes históricos de existencias', true, CURRENT_TIMESTAMP),
  ('expenses', 'Control de gastos', 'Gastos, categorías y reportes', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "TenantModuleSetting" ("tenantId", "moduleKey", "enabled", "updatedAt")
SELECT tenant."id", module."key", module."defaultEnabled", CURRENT_TIMESTAMP
FROM "Tenant" tenant CROSS JOIN "ModuleCatalog" module
ON CONFLICT ("tenantId", "moduleKey") DO NOTHING;

ALTER TABLE "TenantModuleSetting" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TenantModuleSetting_current_tenant" ON "TenantModuleSetting"
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id());
