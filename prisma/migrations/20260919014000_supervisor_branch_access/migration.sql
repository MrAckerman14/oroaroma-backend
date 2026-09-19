INSERT INTO "Permission" ("id", "key", "resource", "action", "scope")
VALUES (gen_random_uuid()::text, 'branches:read:assigned', 'branches', 'read', 'ASSIGNED')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission ON permission."key" = 'branches:read:assigned'
WHERE role."key" = 'supervisor'
ON CONFLICT DO NOTHING;
