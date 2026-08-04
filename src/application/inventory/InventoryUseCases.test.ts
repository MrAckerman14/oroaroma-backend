import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { InventoryUseCases } from './InventoryUseCases.js';

const employee: AuthenticatedUser = {
  id: 'employee-1',
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
