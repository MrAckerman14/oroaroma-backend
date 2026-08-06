DELETE FROM "RolePermission"
WHERE "roleId" = (
  SELECT "id" FROM "Role" WHERE "key" = 'supervisor'
)
AND "permissionId" IN (
  SELECT "id" FROM "Permission"
  WHERE "resource" = 'sales'
);
