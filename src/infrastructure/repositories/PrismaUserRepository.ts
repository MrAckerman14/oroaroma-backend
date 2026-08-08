import type { PrismaClient } from '@prisma/client';
import {
  labelFromMap,
  permissionActionLabels,
  permissionResourceLabels,
  permissionScopeLabels,
  userStatusLabels
} from '../../shared/utils/spanishLabels.js';
import { canonicalRoleKey } from '../../shared/utils/roleKeys.js';
import type { AuthenticatedUser, PermissionDescriptor, UserRoleContext } from '../../types/rbac.js';

type UserWithAccess = NonNullable<Awaited<ReturnType<PrismaUserRepository['findRawUserByEmail']>>>;

export class PrismaUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findRawUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: this.accessIncludes()
    });
  }

  findRawUserById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: this.accessIncludes()
    });
  }

  async findAuthenticatedById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.findRawUserById(id);
    return user ? this.toAuthenticatedUser(user) : null;
  }

  toAuthenticatedUser(user: UserWithAccess): AuthenticatedUser {
    const activeAssignments = user.roleAssignments.filter((assignment) => {
      return !assignment.expiresAt || assignment.expiresAt > new Date();
    });

    const roles: UserRoleContext[] = activeAssignments.map((assignment) => ({
      roleKey: canonicalRoleKey(assignment.role.key),
      scope: assignment.scope.toLowerCase() as UserRoleContext['scope'],
      scopeLabel: labelFromMap(permissionScopeLabels, assignment.scope.toLowerCase()),
      ...(assignment.storeId ? { storeId: assignment.storeId } : {}),
      ...(assignment.expiresAt ? { expiresAt: assignment.expiresAt } : {})
    }));

    const permissionMap = new Map<string, PermissionDescriptor>();

    for (const assignment of activeAssignments) {
      for (const rolePermission of assignment.role.permissions) {
        const permission = rolePermission.permission;
        permissionMap.set(permission.key, {
          key: permission.key as PermissionDescriptor['key'],
          resource: permission.resource as PermissionDescriptor['resource'],
          resourceLabel: labelFromMap(permissionResourceLabels, permission.resource),
          action: permission.action as PermissionDescriptor['action'],
          actionLabel: labelFromMap(permissionActionLabels, permission.action),
          scope: permission.scope.toLowerCase() as PermissionDescriptor['scope'],
          scopeLabel: labelFromMap(permissionScopeLabels, permission.scope.toLowerCase())
        });
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      statusLabel: labelFromMap(userStatusLabels, user.status),
      roles,
      permissions: [...permissionMap.values()]
    };
  }

  private accessIncludes() {
    return {
      roleAssignments: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    } as const;
  }
}
