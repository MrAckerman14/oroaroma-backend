import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BranchUseCases } from '../../application/branches/BranchUseCases.js';
import { CreateSaleUseCase } from '../../application/sales/CreateSaleUseCase.js';
import { SaleUseCases } from '../../application/sales/SaleUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
const tenantId = `branch-stock-${suffix}`;
let actor: AuthenticatedUser;
let branchA: { id: string; defaultInventoryPoolId: string | null };
let branchB: { id: string; defaultInventoryPoolId: string | null };
let productId: string;

describeDb('branch inventory isolation and reversible sales', () => {
  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: 'Branch stock test' } });
    const user = await prisma.user.create({ data: { tenantId, name: 'Admin', email: `${tenantId}@test.local`, passwordHash: 'x' } });
    actor = {
      id: user.id, tenantId, email: user.email, name: user.name, status: 'ACTIVE', statusLabel: 'Activo',
      roles: [{ roleKey: 'admin', scope: 'global' }],
      permissions: [{ key: 'sales:cancel:global', resource: 'sales', action: 'cancel', scope: 'global' }]
    };
    const branches = new BranchUseCases(prisma);
    branchA = await branches.create(actor, { name: 'Centro', code: 'CENTRO' });
    branchB = await branches.create(actor, { name: 'Norte', code: 'NORTE' });
    const product = await prisma.store.create({ data: { tenantId, name: 'Producto', purchasePrice: 50, salePrice: 100, stock: 0 } });
    productId = product.id;
    await prisma.inventoryPoolStock.createMany({ data: [
      { tenantId, poolId: branchA.defaultInventoryPoolId!, productId, stock: 10 },
      { tenantId, poolId: branchB.defaultInventoryPoolId!, productId, stock: 0 }
    ] });
  });

  afterAll(async () => {
    await prisma.saleDetail.deleteMany({ where: { tenantId } });
    await prisma.sale.deleteMany({ where: { tenantId } });
    await prisma.branchInventoryProductOverride.deleteMany({ where: { tenantId } });
    await prisma.inventoryPoolStock.deleteMany({ where: { tenantId } });
    await prisma.branchMembership.deleteMany({ where: { tenantId } });
    await prisma.store.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.inventoryPool.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('keeps independent stock separate and returns shared stock to its original pool on cancellation', async () => {
    const createSale = new CreateSaleUseCase(prisma);
    const sales = new SaleUseCases(prisma);
    const branches = new BranchUseCases(prisma);
    const saleA = await createSale.execute(actor.id, tenantId, branchA.id, {
      amount: '200', amountCash: '200', amountTransfer: '0', deliveryPay: '0', items: [{ productId, quantity: 2 }]
    });
    expect(await balance(branchA.defaultInventoryPoolId!)).toBe(8);
    expect(await balance(branchB.defaultInventoryPoolId!)).toBe(0);

    await branches.configureInventorySharing(actor, branchB.id, { mode: 'FULL', sourceBranchId: branchA.id });
    const saleB = await createSale.execute(actor.id, tenantId, branchB.id, {
      amount: '300', amountCash: '300', amountTransfer: '0', deliveryPay: '0', items: [{ productId, quantity: 3 }]
    });
    expect(await balance(branchA.defaultInventoryPoolId!)).toBe(5);

    await sales.update(saleB.id, actor, branchB.id, { status: 'CANCELLED' });
    expect(await balance(branchA.defaultInventoryPoolId!)).toBe(8);
    await expect(sales.update(saleA.id, actor, branchB.id, { status: 'CANCELLED' })).rejects.toThrow('Venta no encontrada');
  });
});

async function balance(poolId: string) {
  return (await prisma.inventoryPoolStock.findUniqueOrThrow({ where: { poolId_productId: { poolId, productId } } })).stock;
}
