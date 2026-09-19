import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SaleUseCases } from './SaleUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

describe('SaleUseCases state transitions', () => {
  const assertTransition = (current: 'DELIVERY_PENDING' | 'FINALIZED' | 'CANCELLED', next: 'DELIVERY_PENDING' | 'FINALIZED' | 'CANCELLED', hasClosure = false) => {
    const sales = new SaleUseCases({} as PrismaClient);
    return () => (sales as unknown as {
      assertStatusTransition: (currentStatus: typeof current, nextStatus: typeof next, closed: boolean) => void;
    }).assertStatusTransition(current, next, hasClosure);
  };

  it('impide reabrir una venta finalizada', () => {
    expect(assertTransition('FINALIZED', 'DELIVERY_PENDING')).toThrow('Una venta finalizada no puede volver');
  });

  it('impide cambiar una venta incluida en un cierre', () => {
    expect(assertTransition('DELIVERY_PENDING', 'CANCELLED', true)).toThrow('incluida en un cierre');
  });
});

describe('SaleUseCases participant reassignment', () => {
  const ownActor: AuthenticatedUser = {
    id: 'user-1', tenantId: 'tenant-1', email: 'one@test.local', name: 'One',
    status: 'ACTIVE', statusLabel: 'Activo', roles: [],
    permissions: [{ key: 'sales:update:own', resource: 'sales', action: 'update', scope: 'own' }]
  };

  it('rechaza que un permiso propio reasigne participantes', () => {
    const sales = new SaleUseCases({} as PrismaClient);
    const invoke = () => (sales as unknown as {
      assertParticipantReassignmentAllowed: (actor: AuthenticatedUser, sale: object, input: object) => void;
    }).assertParticipantReassignmentAllowed(
      ownActor,
      { employeeId: ownActor.id, messengerId: null, sellerId: null },
      { employeeId: 'user-2' }
    );
    expect(invoke).toThrow('permiso global');
  });

  it('no revalida participantes históricos cuando no se reasignan', async () => {
    const sales = new SaleUseCases({} as PrismaClient);
    const findMany = vi.fn();
    await (sales as unknown as {
      assertUpdatedParticipants: (tx: object, sale: object, input: object) => Promise<void>;
    }).assertUpdatedParticipants(
      { user: { findMany } },
      { tenantId: 'tenant-1', branchId: 'branch-1', employeeId: ownActor.id, messengerId: null, sellerId: null },
      { status: 'CANCELLED' }
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
