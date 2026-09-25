import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BranchUseCases } from '../../application/branches/BranchUseCases.js';
import { WarehouseUseCases } from '../../application/warehouses/WarehouseUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
const tenantId = `warehouse-${suffix}`;
const otherTenantId = `warehouse-other-${suffix}`;
let actor: AuthenticatedUser;
let branchId: string;
let primaryWarehouseId: string;
let secondaryWarehouseId: string;
let productId: string;

describeDb('multi warehouse inventory', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({ data: [
      { id: tenantId, slug: tenantId, name: 'Warehouse test' },
      { id: otherTenantId, slug: otherTenantId, name: 'Other warehouse test' }
    ] });
    const user = await prisma.user.create({ data: { tenantId, name: 'Admin', email: `${tenantId}@test.local`, passwordHash: 'x' } });
    actor = {
      id: user.id, tenantId, email: user.email, name: user.name, status: 'ACTIVE', statusLabel: 'Activo', roles: [],
      permissions: [
        { key: 'warehouses:create:global', resource: 'warehouses', action: 'create', scope: 'global' },
        { key: 'warehouses:read:global', resource: 'warehouses', action: 'read', scope: 'global' },
        { key: 'warehouses:transfer:global', resource: 'warehouses', action: 'transfer', scope: 'global' }
      ]
    };
    const branch = await new BranchUseCases(prisma).create(actor, { name: 'Centro', code: 'CENTRO' });
    branchId = branch.id;
    actor.branches = [{ id: branch.id, name: branch.name, code: branch.code, isPrimary: false }];
    const warehouses = new WarehouseUseCases(prisma);
    primaryWarehouseId = (await warehouses.list(actor, branchId)).find((warehouse) => warehouse.isDefault)!.id;
    secondaryWarehouseId = (await warehouses.create(actor, branchId, { name: 'Reserva', code: 'RESERVA' })).id;
    const product = await prisma.store.create({ data: { tenantId, name: 'Producto', purchasePrice: 50, salePrice: 100, stock: 0 } });
    productId = product.id;
    const primary = await prisma.warehouse.findUniqueOrThrow({ where: { id: primaryWarehouseId } });
    await prisma.inventoryPoolStock.create({ data: { tenantId, poolId: primary.inventoryPoolId, productId, stock: 10 } });
  });

  afterAll(async () => {
    await prisma.inventoryTransferItem.deleteMany({ where: { transfer: { tenantId } } }).catch(() => undefined);
    await prisma.$executeRaw`DELETE FROM public."InventoryTransfer" WHERE "tenantId" = ${tenantId}`;
    await prisma.inventoryPoolStock.deleteMany({ where: { tenantId } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.branchMembership.deleteMany({ where: { tenantId } });
    await prisma.store.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.inventoryPool.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await prisma.$disconnect();
  });

  it('moves stock atomically and records an immutable audit document', async () => {
    const warehouses = new WarehouseUseCases(prisma);
    const transfer = await warehouses.transfer(actor, branchId, {
      sourceWarehouseId: primaryWarehouseId, destinationWarehouseId: secondaryWarehouseId,
      reference: 'TR-1', items: [{ productId, quantity: 4 }]
    });
    expect(transfer.items).toHaveLength(1);
    expect(await stock(primaryWarehouseId)).toBe(6);
    expect(await stock(secondaryWarehouseId)).toBe(4);
    expect(transfer.status).toBe('COMPLETED');
  });

  it('rolls back the complete transfer when stock is insufficient', async () => {
    const warehouses = new WarehouseUseCases(prisma);
    const beforeSource = await stock(primaryWarehouseId);
    const beforeDestination = await stock(secondaryWarehouseId);
    await expect(warehouses.transfer(actor, branchId, {
      sourceWarehouseId: primaryWarehouseId, destinationWarehouseId: secondaryWarehouseId,
      items: [{ productId, quantity: beforeSource + 1 }]
    })).rejects.toThrow('Stock insuficiente');
    expect(await stock(primaryWarehouseId)).toBe(beforeSource);
    expect(await stock(secondaryWarehouseId)).toBe(beforeDestination);
  });

  it('does not oversell when transfers race', async () => {
    const warehouses = new WarehouseUseCases(prisma);
    const available = await stock(primaryWarehouseId);
    const results = await Promise.allSettled([
      warehouses.transfer(actor, branchId, { sourceWarehouseId: primaryWarehouseId, destinationWarehouseId: secondaryWarehouseId, items: [{ productId, quantity: available }] }),
      warehouses.transfer(actor, branchId, { sourceWarehouseId: primaryWarehouseId, destinationWarehouseId: secondaryWarehouseId, items: [{ productId, quantity: available }] })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await stock(primaryWarehouseId)).toBe(0);
  });

  it('rejects warehouses from another tenant before moving stock', async () => {
    const pool = await prisma.inventoryPool.create({ data: { tenantId: otherTenantId, name: 'Other', normalizedName: `other-${suffix}` } });
    const branch = await prisma.branch.create({ data: { tenantId: otherTenantId, name: 'Other', normalizedName: 'other', code: 'OTHER', defaultInventoryPoolId: pool.id } });
    const other = await prisma.warehouse.create({ data: { tenantId: otherTenantId, branchId: branch.id, inventoryPoolId: pool.id, name: 'Other', normalizedName: 'other', code: 'OTHER', isDefault: true } });
    await expect(new WarehouseUseCases(prisma).transfer(actor, branchId, {
      sourceWarehouseId: secondaryWarehouseId, destinationWarehouseId: other.id, items: [{ productId, quantity: 1 }]
    })).rejects.toThrow('no está disponible');
    await prisma.warehouse.delete({ where: { id: other.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
    await prisma.inventoryPool.delete({ where: { id: pool.id } });
  });
});

async function stock(warehouseId: string) {
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { id: warehouseId } });
  return (await prisma.inventoryPoolStock.findUnique({ where: { poolId_productId: { poolId: warehouse.inventoryPoolId, productId } } }))?.stock ?? 0;
}
