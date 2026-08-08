import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { UserUseCases } from './UserUseCases.js';

describe('UserUseCases role labels', () => {
  it('presenta nombres publicos sin exponer la llave interna del rol', () => {
    const users = new UserUseCases({} as PrismaClient, {} as PasswordHasher);
    const presentRole = (users as unknown as {
      presentRole: (role: { key: string; name: string }) => { key?: string; name: string; label: string; displayName: string };
    }).presentRole.bind(users);

    const employeeRole = presentRole({ key: 'employee', name: 'Colaborador' });
    expect(employeeRole).toMatchObject({
      name: 'Vendedor',
      label: 'Vendedor',
      displayName: 'Vendedor'
    });
    expect(employeeRole).not.toHaveProperty('key');
    const supervisorRole = presentRole({ key: 'supervisor', name: 'Supervisor' });
    expect(supervisorRole).toMatchObject({
      name: 'Supervisor'
    });
    expect(supervisorRole).not.toHaveProperty('key');
    const collaboratorRole = presentRole({ key: 'seller', name: 'Vendedor' });
    expect(collaboratorRole).toMatchObject({
      name: 'Colaborador',
      label: 'Colaborador',
      displayName: 'Colaborador'
    });
    expect(collaboratorRole).not.toHaveProperty('key');
  });
});

describe('UserUseCases listOptions', () => {
  it('no entrega usuarios al colaborador en el endpoint de opciones', async () => {
    const actor: AuthenticatedUser = {
      id: 'seller-1',
      email: 'seller@oroaroma.local',
      name: 'Colaborador',
      status: 'ACTIVE',
      statusLabel: 'Activo',
      roles: [{ roleKey: 'seller', scope: 'own' }],
      permissions: []
    };
    const prisma = {
      user: {
        findMany: vi.fn(),
        count: vi.fn()
      },
      sale: {
        aggregate: vi.fn(async () => ({
          _count: { id: 0 },
          _sum: {
            amountCash: new Prisma.Decimal(0),
            deliveryPay: new Prisma.Decimal(0)
          }
        }))
      }
    };
    const users = new UserUseCases(prisma as unknown as PrismaClient, {} as PasswordHasher);

    const result = await users.listOptions({ page: 1, pageSize: 100 }, actor);

    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.sale.aggregate).not.toHaveBeenCalled();
  });

  it('permite al vendedor ver colaboradores y mensajeros para crear ventas', async () => {
    const actor: AuthenticatedUser = {
      id: 'employee-1',
      email: 'employee@oroaroma.local',
      name: 'Vendedor',
      status: 'ACTIVE',
      statusLabel: 'Activo',
      roles: [{ roleKey: 'employee', scope: 'own' }],
      permissions: []
    };
    const calls: { findMany?: unknown } = {};
    const prisma = {
      user: {
        findMany: async (args: unknown) => {
          calls.findMany = args;
          return [
            userOption('seller-1', 'Colaborador', 'seller'),
            userOption('messenger-1', 'Mensajero', 'messenger')
          ];
        },
        count: async () => 2
      },
      sale: {
        aggregate: async () => ({
          _count: { id: 0 },
          _sum: {
            amountCash: new Prisma.Decimal(0),
            deliveryPay: new Prisma.Decimal(0)
          }
        })
      }
    };
    const users = new UserUseCases(prisma as unknown as PrismaClient, {} as PasswordHasher);

    const result = await users.listOptions({ page: 1, pageSize: 100 }, actor);

    expect(calls.findMany).toMatchObject({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          {
            roleAssignments: {
              some: {
                role: {
                  key: { in: ['collaborator', 'seller', 'messenger'] }
                }
              }
            }
          }
        ]
      }
    });
    expect(result.items[0]).toMatchObject({
      id: 'seller-1',
      name: 'Colaborador',
      roleName: 'Colaborador'
    });
    expect(result.items[0]).not.toHaveProperty('roleKey');
    expect(result.items[0]).not.toHaveProperty('email');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(result.items[0]).not.toHaveProperty('roles');
    expect(result.items[0]).not.toHaveProperty('roleAssignments');
  });

  it('oculta dinero ganado de mensajero al vendedor y mantiene pendientes de sus ventas', async () => {
    const actor: AuthenticatedUser = {
      id: 'employee-1',
      email: 'employee@oroaroma.local',
      name: 'Vendedor',
      status: 'ACTIVE',
      statusLabel: 'Activo',
      roles: [{ roleKey: 'employee', scope: 'own' }],
      permissions: []
    };
    const aggregate = vi
      .fn()
      .mockResolvedValueOnce({
        _count: { id: 2 },
        _sum: { deliveryPay: new Prisma.Decimal(450) }
      })
      .mockResolvedValueOnce({
        _count: { id: 0 },
        _sum: {
          amountCash: new Prisma.Decimal(1200),
          deliveryPay: new Prisma.Decimal(150)
        }
      });
    const prisma = {
      user: {
        findMany: async () => [userOption('messenger-1', 'Mensajero', 'messenger')],
        count: async () => 1
      },
      sale: { aggregate }
    };
    const users = new UserUseCases(prisma as unknown as PrismaClient, {} as PasswordHasher);

    const result = await users.listOptions({ page: 1, pageSize: 100, includeStats: true }, actor);

    expect(aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        messengerId: 'messenger-1',
        status: { in: ['FINALIZED', 'CANCELLED'] },
        OR: [
          { employeeId: 'employee-1' },
          { sellerId: 'employee-1' },
          { messengerId: 'employee-1' }
        ]
      }),
      _sum: { deliveryPay: true }
    }));
    expect(aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        messengerId: 'messenger-1',
        status: 'DELIVERY_PENDING',
        OR: [
          { employeeId: 'employee-1' },
          { sellerId: 'employee-1' },
          { messengerId: 'employee-1' }
        ]
      }),
      _sum: { amountCash: true, deliveryPay: true }
    }));
    expect(result.items[0]).toMatchObject({
      completedDeliveries: 2,
      deliveriesCount: 2,
      pendingDeliveryPay: new Prisma.Decimal(150),
      pendingMoney: new Prisma.Decimal(1200)
    });
    expect(result.items[0]).not.toHaveProperty('completedDeliveryPay');
    expect(result.items[0]).not.toHaveProperty('earnedMoney');
    expect(result.items[0]).not.toHaveProperty('messengerEarnings');
    expect(result.items[0]).not.toHaveProperty('totalEarned');
    expect(result.items[0]).not.toHaveProperty('email');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(result.items[0]).not.toHaveProperty('roles');
    expect(result.items[0]).not.toHaveProperty('roleAssignments');
  });
});

describe('UserUseCases dashboard', () => {
  it('no entrega listado de usuarios al supervisor', async () => {
    const actor: AuthenticatedUser = {
      id: 'supervisor-1',
      email: 'supervisor@oroaroma.local',
      name: 'Supervisor',
      status: 'ACTIVE',
      statusLabel: 'Activo',
      roles: [{ roleKey: 'supervisor', scope: 'own' }],
      permissions: [{ key: 'users:read:global', resource: 'users', action: 'read', scope: 'global' }]
    };
    const calls: { findMany?: unknown; count?: unknown } = {};
    const prisma = {
      user: {
        findMany: vi.fn(async (args: unknown) => {
          calls.findMany = args;
          return [];
        }),
        count: vi.fn(async (args: unknown) => {
          calls.count = args;
          return 0;
        })
      },
      sale: {
        findMany: vi.fn(async () => []),
        aggregate: vi.fn(async () => ({
          _count: { id: 0 },
          _sum: {
            amountCash: new Prisma.Decimal(0),
            deliveryPay: new Prisma.Decimal(0)
          }
        }))
      }
    };
    const users = new UserUseCases(prisma as unknown as PrismaClient, {} as PasswordHasher);

    const result = await users.dashboard({ page: 1, pageSize: 100, roleKeys: ['admin', 'seller', 'employee'] }, actor);

    expect(calls.findMany).toMatchObject({
      where: {
        deletedAt: null,
        roleAssignments: {
          some: {
            role: {
              key: { in: [] }
            }
          }
        }
      }
    });
    expect(calls.count).toMatchObject({
      where: {
        deletedAt: null,
        roleAssignments: {
          some: {
            role: {
              key: { in: [] }
            }
          }
        }
      }
    });
    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});

function userOption(id: string, name: string, roleKey: string) {
  return {
    id,
    name,
    email: `${id}@oroaroma.local`,
    status: 'ACTIVE',
    roleAssignments: [{
      role: {
        key: roleKey,
        name: roleKey
      }
    }]
  };
}
