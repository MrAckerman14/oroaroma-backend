INSERT INTO "Permission" ("id", "key", "resource", "action", "scope", "description", "createdAt")
VALUES ('perm-users-read-global', 'users:read:global', 'users', 'read', 'GLOBAL', NULL, NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role_row."id", permission_row."id", NOW()
FROM "Role" role_row
JOIN "Permission" permission_row ON permission_row."key" = 'users:read:global'
WHERE role_row."key" = 'supervisor'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
