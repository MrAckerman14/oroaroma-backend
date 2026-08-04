import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { UserUseCases } from './UserUseCases.js';

describe('UserUseCases role labels', () => {
  it('presenta los nombres nuevos usando la llave interna del rol', () => {
    const users = new UserUseCases({} as PrismaClient, {} as PasswordHasher);
    const presentRole = (users as unknown as {
      presentRole: (role: { key: string; name: string }) => { name: string; label: string; displayName: string };
    }).presentRole.bind(users);

    expect(presentRole({ key: 'employee', name: 'Colaborador' })).toMatchObject({
      name: 'Vendedor',
      label: 'Vendedor',
      displayName: 'Vendedor'
    });
    expect(presentRole({ key: 'supervisor', name: 'Supervisor' })).toMatchObject({
      name: 'Supervisor'
    });
    expect(presentRole({ key: 'seller', name: 'Vendedor' })).toMatchObject({
      name: 'Colaborador',
      label: 'Colaborador',
      displayName: 'Colaborador'
    });
  });
});

describe('UserUseCases listOptions', () => {
  it('incluye al colaborador autenticado y los mensajeros para crear ventas', async () => {
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
        findMany: async (args: unknown) => {
          calls.findMany = args;
          return [
            userOption('seller-1', 'Colaborador', 'seller'),
            userOption('messenger-1', 'Mensajero', 'messenger')
          ];
        },
        count: async (args: unknown) => {
          calls.count = args;
          return 2;
        }
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
    const calls: { findMany?: unknown; count?: unknown } = {};

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
                  key: { in: ['messenger'] }
                }
              }
            }
          },
          { id: 'seller-1' }
        ]
      }
    });
    expect(result.items.map((item) => item.roleKey)).toEqual(['seller', 'messenger']);
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
