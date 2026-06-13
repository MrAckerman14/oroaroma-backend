import type {
  AuthorizationDecision,
  AuthorizationRequest,
  PermissionDescriptor,
  PermissionKey,
  RbacScope
} from '../../types/rbac.js';

const scopePriority: Record<RbacScope, number> = {
  global: 4,
  store: 3,
  assigned: 2,
  own: 1
};

export class RbacPolicy {
  can(request: AuthorizationRequest): AuthorizationDecision {
    if (request.actor.status !== 'ACTIVE') {
      return { allowed: false, reason: 'USER_NOT_ACTIVE' };
    }

    const candidates = request.actor.permissions
      .filter((permission) => permission.resource === request.resource)
      .filter((permission) => permission.action === request.action)
      .sort((a, b) => scopePriority[b.scope] - scopePriority[a.scope]);

    let deniedDecision: AuthorizationDecision | undefined;

    for (const permission of candidates) {
      const decision = this.evaluateScope(permission, request);
      if (decision.allowed) {
        return decision;
      }
      deniedDecision ??= decision;
    }

    return deniedDecision ?? { allowed: false, reason: 'NO_MATCHING_PERMISSION' };
  }

  private evaluateScope(
    permission: PermissionDescriptor,
    request: AuthorizationRequest
  ): AuthorizationDecision {
    const matchedPermission: PermissionKey = permission.key;

    if (permission.scope === 'global') {
      return { allowed: true, matchedPermission };
    }

    if (permission.scope === 'own') {
      const allowed = request.action === 'create'
        ? !request.ownerId || request.ownerId === request.actor.id
        : request.ownerId === request.actor.id;
      return allowed
        ? { allowed, matchedPermission }
        : { allowed, reason: 'OWNER_MISMATCH', matchedPermission };
    }

    if (permission.scope === 'assigned') {
      const isAssigned = request.assignedUserIds?.includes(request.actor.id) ?? false;
      return isAssigned
        ? { allowed: true, matchedPermission }
        : { allowed: false, reason: 'ASSIGNMENT_MISMATCH', matchedPermission };
    }

    const roleHasStoreAccess = request.actor.roles.some((role) => {
      if (role.scope === 'global') return true;
      return role.scope === 'store' && role.storeId === request.storeId;
    });

    return roleHasStoreAccess
      ? { allowed: true, matchedPermission }
      : { allowed: false, reason: 'STORE_SCOPE_MISMATCH', matchedPermission };
  }
}
