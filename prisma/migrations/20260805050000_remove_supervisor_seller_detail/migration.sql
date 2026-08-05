DELETE FROM "RolePermission"
WHERE "roleId" IN (
  SELECT "id" FROM "Role" WHERE "key" = 'supervisor'
)
AND "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "key" = 'reports:cash-detail-sellers:own'
);
