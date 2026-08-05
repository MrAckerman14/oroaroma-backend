INSERT INTO "Role" ("id", "key", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES ('role-supervisor', 'supervisor', 'Supervisor', 'Crea y gestiona sus ventas con acceso al detalle de colaboradores', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isSystem" = true,
  "updatedAt" = NOW();

INSERT INTO "Permission" ("id", "key", "resource", "action", "scope", "description", "createdAt")
VALUES
  ('perm-stores-read-global', 'stores:read:global', 'stores', 'read', 'GLOBAL', NULL, NOW()),
  ('perm-sales-create-own', 'sales:create:own', 'sales', 'create', 'OWN', NULL, NOW()),
  ('perm-sales-read-own', 'sales:read:own', 'sales', 'read', 'OWN', NULL, NOW()),
  ('perm-sales-update-own', 'sales:update:own', 'sales', 'update', 'OWN', NULL, NOW()),
  ('perm-sales-finalize-own', 'sales:finalize:own', 'sales', 'finalize', 'OWN', NULL, NOW()),
  ('perm-sales-cancel-own', 'sales:cancel:own', 'sales', 'cancel', 'OWN', NULL, NOW()),
  ('perm-reports-cash-own', 'reports:cash:own', 'reports', 'cash', 'OWN', NULL, NOW()),
  ('perm-reports-cash-detail-messengers-own', 'reports:cash-detail-messengers:own', 'reports', 'cash-detail-messengers', 'OWN', NULL, NOW()),
  ('perm-reports-cash-detail-sellers-own', 'reports:cash-detail-sellers:own', 'reports', 'cash-detail-sellers', 'OWN', NULL, NOW()),
  ('perm-reports-cash-detail-employees-own', 'reports:cash-detail-employees:own', 'reports', 'cash-detail-employees', 'OWN', NULL, NOW()),
  ('perm-cash-closures-read-own', 'cash-closures:read:own', 'cash-closures', 'read', 'OWN', NULL, NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role_row."id", permission_row."id", NOW()
FROM "Role" role_row
JOIN "Permission" permission_row ON permission_row."key" IN (
  'stores:read:global',
  'sales:create:own',
  'sales:read:own',
  'sales:update:own',
  'sales:finalize:own',
  'sales:cancel:own',
  'reports:cash:own',
  'reports:cash-detail-messengers:own',
  'reports:cash-detail-sellers:own',
  'reports:cash-detail-employees:own',
  'cash-closures:read:own'
)
WHERE role_row."key" = 'supervisor'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
