import { describe, expect, it } from 'vitest';
import { RbacPolicy } from '../../../domain/access/RbacPolicy.js';
import type { AuthenticatedUser } from '../../../types/rbac.js';
import { canEnterResource, canUseImplicitPrimaryBranch } from './authPlugin.js';

const actor: AuthenticatedUser = {
  id: 'user-1', tenantId: 'tenant-1', email: 'one@test.local', name: 'One',
  status: 'ACTIVE', statusLabel: 'Activo', roles: [], branches: [],
  permissions: [{ key: 'sales:read:own', resource: 'sales', action: 'read', scope: 'own' }]
};

describe('route capability authorization', () => {
  it('deja que el caso de uso evalúe la propiedad de lecturas own', () => {
    expect(canEnterResource(new RbacPolicy(), actor, 'sales', 'read').allowed).toBe(true);
  });

  it('rechaza acciones sin una capacidad compatible', () => {
    expect(canEnterResource(new RbacPolicy(), actor, 'sales', 'delete').allowed).toBe(false);
  });

  it('no asigna silenciosamente la sucursal principal a usuarios sin membresias', () => {
    expect(canUseImplicitPrimaryBranch(actor)).toBe(false);
    expect(canUseImplicitPrimaryBranch({
      ...actor,
      permissions: [{ key: 'branches:read:global', resource: 'branches', action: 'read', scope: 'global' }]
    })).toBe(true);
  });
});
