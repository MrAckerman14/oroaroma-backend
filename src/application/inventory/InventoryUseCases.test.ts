import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { InventoryUseCases } from './InventoryUseCases.js';

const employee: AuthenticatedUser = {
  id: 'employee-1',
  tenantId: 'default',
  email: 'empleado@oroaroma.local',
  name: 'Empleado',
  status: 'ACTIVE',
  statusLabel: 'Activo',
  roles: [{ roleKey: 'employee', scope: 'own' }],
  permissions: [{
    key: 'inventory-reports:read:own',
    resource: 'inventory-reports',
    action: 'read',
    scope: 'own'
  }]
};

describe('InventoryUseCases', () => {
  it('calcula el valor con el stock efectivo y omite productos invisibles', async () => {
    const prisma = {
      branch: { findFirst: vi.fn().mockResolvedValue({ defaultInventoryPoolId: 'pool-1' }) },
      store: { findMany: vi.fn().mockResolvedValue([{ id: 'product-1', name: 'Producto', purchasePrice: new Prisma.Decimal(10), stock: 999 }]) },
      branchInventoryProductOverride: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryPoolStock: { findMany: vi.fn().mockResolvedValue([{ productId: 'product-1', poolId: 'pool-1', stock: 3 }]) }
    };
    const inventory = new InventoryUseCases(prisma as unknown as PrismaClient);
    const snapshot = await (inventory as unknown as {
      inventorySnapshot: (tenantId: string, branchId: string) => Promise<{ products: Array<{ stock: number; inventoryValue: Prisma.Decimal }> }>;
    }).inventorySnapshot('tenant-1', 'branch-1');

    expect(snapshot.products[0]?.stock).toBe(3);
    expect(snapshot.products[0]?.inventoryValue.toString()).toBe('30');
    expect(prisma.store.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchExclusions: { none: { tenantId: 'tenant-1', branchId: 'branch-1' } } })
    }));
  });

  it('bloquea reportes de inventario a usuarios sin permiso global', async () => {
    const inventory = new InventoryUseCases({} as PrismaClient);

    await expect(inventory.list(employee, {
      page: 1,
      pageSize: 10
    })).rejects.toMatchObject({
      message: 'Permiso requerido para leer reportes de inventario'
    });
  });
});
