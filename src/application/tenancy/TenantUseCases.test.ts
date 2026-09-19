import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import { TenantUseCases } from './TenantUseCases.js';

describe('TenantUseCases', () => {
  it('actualiza módulos dentro de una única transacción interactiva', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback({
      tenantModuleSetting: { upsert }
    }));
    const prisma = {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
      moduleCatalog: { findMany: vi.fn().mockResolvedValue([{ key: 'sales' }, { key: 'inventory' }]) },
      tenantModuleSetting: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: transaction
    };
    const tenants = new TenantUseCases(prisma as unknown as PrismaClient, {} as PasswordHasher);

    await tenants.updateModules('tenant-1', [
      { key: 'sales', enabled: true },
      { key: 'inventory', enabled: false }
    ]);

    expect(transaction).toHaveBeenCalledOnce();
    expect(typeof transaction.mock.calls[0]?.[0]).toBe('function');
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
