import fp from 'fastify-plugin';
import { env } from '../../../config/env.js';
import { ForbiddenError, ModuleDisabledError, UnauthorizedError } from '../../../shared/errors/AppError.js';
import { labelFromMap, permissionActionLabels, permissionResourceLabels } from '../../../shared/utils/spanishLabels.js';
import type { AccessTokenPayload } from '../../../types/auth.js';
import type { AuthenticatedUser, RbacAction, RbacResource } from '../../../types/rbac.js';
import type { RbacPolicy } from '../../../domain/access/RbacPolicy.js';
import { enterTenantDatabaseContext } from '../../../infrastructure/database/prisma.js';
import type { PlatformPermissionKey, TenantModuleKey } from '../../../types/platform.js';

export const authPlugin = fp(async (app) => {
  app.decorate('authenticate', async (request) => {
    let payload: AccessTokenPayload;

    try {
      payload = await request.jwtVerify<AccessTokenPayload>();
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Token invalido o expirado');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedError('Token invalido');
    }

    const tenantId = payload.tenantId ?? env.DEFAULT_TENANT_ID;
    enterTenantDatabaseContext(tenantId);
    const user = await app.container.users.findAuthenticatedById(payload.sub, tenantId);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }
    enterTenantDatabaseContext(user.tenantId);

    request.tenantId = user.tenantId;
    request.authUser = user;
    const requestedBranchId = request.headers['x-branch-id'];
    if (typeof requestedBranchId === 'string' && requestedBranchId) {
      const allowed = user.branches?.some((branch) => branch.id === requestedBranchId);
      const hasGlobalBranchAccess = user.permissions.some((permission) => permission.key === 'branches:read:global');
      if (!allowed && !hasGlobalBranchAccess) throw new ForbiddenError('No tienes acceso a la sucursal seleccionada');
      const branch = await app.container.prisma.branch.findFirst({ where: { id: requestedBranchId, tenantId: user.tenantId, status: 'ACTIVE' }, select: { id: true } });
      if (!branch) throw new ForbiddenError('La sucursal seleccionada no está disponible');
      request.branchId = branch.id;
    } else {
      const primaryMembership = user.branches?.find((branch) => branch.isPrimary) ?? user.branches?.[0];
      if (primaryMembership) {
        request.branchId = primaryMembership.id;
      } else {
        if (!canUseImplicitPrimaryBranch(user)) throw new ForbiddenError('No tienes una sucursal activa asignada');
        const primaryBranch = await app.container.prisma.branch.findFirst({
          where: { tenantId: user.tenantId, status: 'ACTIVE', isPrimary: true },
          select: { id: true }
        });
        if (!primaryBranch) throw new ForbiddenError('No hay una sucursal activa disponible');
        request.branchId = primaryBranch.id;
      }
    }
  });

  app.decorate('authorize', (resource: RbacResource, action: RbacAction) => {
    return async (request) => {
      if (!request.authUser) {
        throw new UnauthorizedError();
      }

      const moduleKey = moduleForResource(resource);
      if (moduleKey && !(request.authUser.enabledModules ?? []).includes(moduleKey)) {
        throw new ModuleDisabledError(moduleKey);
      }

      // Resource ownership is only known after the record is loaded. At route
      // entry, require a matching capability and leave scope enforcement to the
      // owning use case. Branch assignment is available here and remains strict.
      const decision = canEnterResource(app.container.rbacPolicy, request.authUser, resource, action);

      if (!decision.allowed) {
        const resourceLabel = labelFromMap(permissionResourceLabels, resource) ?? resource;
        const actionLabel = labelFromMap(permissionActionLabels, action) ?? action;
        throw new ForbiddenError(`Permiso requerido para ${actionLabel} ${resourceLabel}`);
      }
    };
  });

  app.decorate('authorizePlatform', (permission: PlatformPermissionKey) => {
    return async (request) => {
      if (!request.authUser) throw new UnauthorizedError();
      if (!(request.authUser.platformPermissions ?? []).includes(permission)) {
        throw new ForbiddenError('No tienes permisos de plataforma para realizar esta accion');
      }
      enterTenantDatabaseContext(request.authUser.tenantId, true);
    };
  });

  app.decorate('requireTenantModule', (moduleKey: TenantModuleKey) => {
    return async (request) => {
      if (!request.authUser) throw new UnauthorizedError();
      if (!(request.authUser.enabledModules ?? []).includes(moduleKey)) {
        throw new ModuleDisabledError(moduleKey);
      }
    };
  });
});

export function canUseImplicitPrimaryBranch(user: AuthenticatedUser) {
  return user.permissions.some((permission) => permission.key === 'branches:read:global');
}

export function canEnterResource(
  policy: Pick<RbacPolicy, 'can'>,
  actor: AuthenticatedUser,
  resource: RbacResource,
  action: RbacAction
) {
  if (resource === 'branches') {
    return policy.can({
      actor,
      resource,
      action,
      assignedUserIds: actor.branches?.length ? [actor.id] : []
    });
  }
  if (action === 'create') {
    return policy.can({ actor, resource, action, ownerId: actor.id });
  }
  return {
    allowed: actor.permissions.some((permission) => (
      permission.resource === resource && permission.action === action
    ))
  };
}

function moduleForResource(resource: RbacResource): TenantModuleKey | null {
  const modules: Partial<Record<RbacResource, TenantModuleKey>> = {
    users: 'users',
    roles: 'users',
    permissions: 'users',
    stores: 'inventory',
    sales: 'sales',
    'cash-closures': 'cash-closures',
    reports: 'cash-closures',
    'inventory-reports': 'inventory-reports',
    'expense-controls': 'expenses',
    branches: 'users',
    warehouses: 'inventory'
  };
  return modules[resource] ?? null;
}
