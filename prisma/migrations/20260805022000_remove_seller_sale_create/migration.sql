DELETE FROM "RolePermission"
WHERE "roleId" IN (
  SELECT "id" FROM "Role" WHERE "key" = 'seller'
)
AND "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "key" = 'sales:create:own'
);
