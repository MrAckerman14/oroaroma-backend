import { describe, expect, it } from 'vitest';
import { RbacPolicy } from '../src/domain/access/RbacPolicy.js';
import type { AuthenticatedUser } from '../src/types/rbac.js';

function actor(permissionKey: AuthenticatedUser['permissions'][number]['key']): AuthenticatedUser {
  const [resource, action, scope] = permissionKey.split(':') as [
    AuthenticatedUser['permissions'][number]['resource'],
    AuthenticatedUser['permissions'][number]['action'],
    AuthenticatedUser['permissions'][number]['scope']
  ];

  return {
    id: 'user-1',
    email: 'user@oroaroma.local',
    name: 'User',
    status: 'ACTIVE',
    roles: [{ roleKey: 'employee', scope: 'global' }],
    permissions: [{ key: permissionKey, resource, action, scope }]
  };
}

describe('RbacPolicy', () => {
  it('does not allow own scoped read without an owner context', () => {
    const policy = new RbacPolicy();

    const decision = policy.can({
      actor: actor('sales:read:own'),
      resource: 'sales',
      action: 'read'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('OWNER_MISMATCH');
  });

  it('allows own scoped read when the owner matches', () => {
    const policy = new RbacPolicy();

    const decision = policy.can({
      actor: actor('sales:read:own'),
      resource: 'sales',
      action: 'read',
      ownerId: 'user-1'
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows own scoped create for the current actor', () => {
    const policy = new RbacPolicy();

    const decision = policy.can({
      actor: actor('sales:create:own'),
      resource: 'sales',
      action: 'create'
    });

    expect(decision.allowed).toBe(true);
  });
});
