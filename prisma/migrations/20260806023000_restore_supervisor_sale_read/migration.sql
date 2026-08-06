INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" = 'supervisor'
  AND p."key" = 'sales:read:own'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
