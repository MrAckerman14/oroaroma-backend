INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role_row."id", permission_row."id", NOW()
FROM "Role" role_row
CROSS JOIN "Permission" permission_row
WHERE role_row."key" = 'supervisor'
  AND permission_row."key" IN (
    'sales:create:own',
    'sales:read:own',
    'sales:update:own',
    'sales:finalize:own',
    'sales:cancel:own',
    'stores:read:global',
    'reports:cash:own',
    'reports:cash-detail-messengers:own',
    'cash-closures:read:own',
    'users:read:global'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
