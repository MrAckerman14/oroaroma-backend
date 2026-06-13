import { PrismaClient, PermissionScope } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissions = [
  ['users:create:global', 'users', 'create', PermissionScope.GLOBAL],
  ['users:read:global', 'users', 'read', PermissionScope.GLOBAL],
  ['users:update:global', 'users', 'update', PermissionScope.GLOBAL],
  ['users:delete:global', 'users', 'delete', PermissionScope.GLOBAL],
  ['roles:assign:global', 'roles', 'assign', PermissionScope.GLOBAL],
  ['roles:read:global', 'roles', 'read', PermissionScope.GLOBAL],
  ['permissions:read:global', 'permissions', 'read', PermissionScope.GLOBAL],
  ['stores:create:global', 'stores', 'create', PermissionScope.GLOBAL],
  ['stores:read:global', 'stores', 'read', PermissionScope.GLOBAL],
  ['stores:read:own', 'stores', 'read', PermissionScope.OWN],
  ['stores:update:global', 'stores', 'update', PermissionScope.GLOBAL],
  ['stores:delete:global', 'stores', 'delete', PermissionScope.GLOBAL],
  ['stores:restore:global', 'stores', 'restore', PermissionScope.GLOBAL],
  ['sales:create:own', 'sales', 'create', PermissionScope.OWN],
  ['sales:create:global', 'sales', 'create', PermissionScope.GLOBAL],
  ['sales:read:own', 'sales', 'read', PermissionScope.OWN],
  ['sales:read:store', 'sales', 'read', PermissionScope.STORE],
  ['sales:read:global', 'sales', 'read', PermissionScope.GLOBAL],
  ['sales:update:own', 'sales', 'update', PermissionScope.OWN],
  ['sales:update:global', 'sales', 'update', PermissionScope.GLOBAL],
  ['sales:delete:own', 'sales', 'delete', PermissionScope.OWN],
  ['sales:delete:global', 'sales', 'delete', PermissionScope.GLOBAL],
  ['sales:finalize:own', 'sales', 'finalize', PermissionScope.OWN],
  ['sales:finalize:global', 'sales', 'finalize', PermissionScope.GLOBAL],
  ['sales:cancel:own', 'sales', 'cancel', PermissionScope.OWN],
  ['sales:cancel:global', 'sales', 'cancel', PermissionScope.GLOBAL],
  ['cash-closures:create:global', 'cash-closures', 'create', PermissionScope.GLOBAL],
  ['cash-closures:create:own', 'cash-closures', 'create', PermissionScope.OWN],
  ['cash-closures:read:global', 'cash-closures', 'read', PermissionScope.GLOBAL],
  ['cash-closures:read:own', 'cash-closures', 'read', PermissionScope.OWN],
  ['cash-closures:verify:global', 'cash-closures', 'verify', PermissionScope.GLOBAL],
  ['cash-closures:delete:global', 'cash-closures', 'delete', PermissionScope.GLOBAL],
  ['inventory-reports:create:global', 'inventory-reports', 'create', PermissionScope.GLOBAL],
  ['inventory-reports:read:global', 'inventory-reports', 'read', PermissionScope.GLOBAL],
  ['inventory-reports:read:own', 'inventory-reports', 'read', PermissionScope.OWN],
  ['inventory-reports:delete:global', 'inventory-reports', 'delete', PermissionScope.GLOBAL],
  ['reports:cash:global', 'reports', 'cash', PermissionScope.GLOBAL],
  ['reports:cash:own', 'reports', 'cash', PermissionScope.OWN],
  ['reports:cash-detail-messengers:global', 'reports', 'cash-detail-messengers', PermissionScope.GLOBAL],
  ['reports:cash-detail-messengers:own', 'reports', 'cash-detail-messengers', PermissionScope.OWN],
  ['reports:cash-detail-sellers:global', 'reports', 'cash-detail-sellers', PermissionScope.GLOBAL],
  ['reports:cash-detail-sellers:own', 'reports', 'cash-detail-sellers', PermissionScope.OWN],
  ['reports:cash-detail-employees:global', 'reports', 'cash-detail-employees', PermissionScope.GLOBAL],
  ['reports:cash-detail-employees:own', 'reports', 'cash-detail-employees', PermissionScope.OWN],
  ['reports:export:global', 'reports', 'export', PermissionScope.GLOBAL],
  ['audit-logs:read:global', 'audit-logs', 'read', PermissionScope.GLOBAL]
] as const;

const roleDefinitions = {
  admin: {
    name: 'Administrador',
    description: 'Acceso total al sistema',
    permissions: permissions.map(([key]) => key)
  },
  employee: {
    name: 'Colaborador',
    description: 'Crea y gestiona sus ventas; consulta productos y sus reportes',
    permissions: [
      'stores:read:global',
      'sales:create:own',
      'sales:read:own',
      'sales:update:own',
      'sales:finalize:own',
      'sales:cancel:own',
      'reports:cash:own',
      'reports:cash-detail-messengers:own',
      'cash-closures:read:own',
      'inventory-reports:read:own'
    ]
  },
  seller: {
    name: 'Vendedor',
    description: 'Consulta y da seguimiento a sus ventas asignadas',
    permissions: [
      'stores:read:global',
      'sales:create:own',
      'sales:read:own',
      'reports:cash:own',
      'reports:cash-detail-messengers:own',
      'cash-closures:read:own'
    ]
  },
  messenger: {
    name: 'Mensajero',
    description: 'Consulta y actualiza entregas asignadas',
    permissions: [
      'sales:read:own',
      'sales:update:own',
      'reports:cash:own',
      'reports:cash-detail-messengers:own',
      'cash-closures:read:own'
    ]
  }
} as const;

async function main() {
  for (const [key, resource, action, scope] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { resource, action, scope },
      create: { key, resource, action, scope }
    });
  }

  for (const [roleKey, role] of Object.entries(roleDefinitions)) {
    const savedRole = await prisma.role.upsert({
      where: { key: roleKey },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true
      },
      create: {
        key: roleKey,
        name: role.name,
        description: role.description,
        isSystem: true
      }
    });

    for (const permissionKey of role.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey }
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: savedRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: savedRole.id,
          permissionId: permission.id
        }
      });
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: savedRole.id,
        permission: {
          key: {
            notIn: [...role.permissions]
          }
        }
      }
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@oroaroma.local' },
    update: {
      name: 'admin',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE'
    },
    create: {
      name: 'admin',
      email: 'admin@oroaroma.local',
      passwordHash: adminPasswordHash
    }
  });

  await prisma.userRoleAssignment.upsert({
    where: { id: 'seed-admin-global-role' },
    update: {},
    create: {
      id: 'seed-admin-global-role',
      userId: admin.id,
      roleId: adminRole.id,
      scope: PermissionScope.GLOBAL
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
