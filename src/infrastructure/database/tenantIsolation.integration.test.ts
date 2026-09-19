import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

const prisma = new PrismaClient();
const runId = `tenant-test-${Date.now()}`;
const tenantA = `${runId}-a`;
const tenantB = `${runId}-b`;
let branchA: { id: string; defaultInventoryPoolId: string | null };
let branchB: { id: string; defaultInventoryPoolId: string | null };

describeDb('tenant SQL isolation', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({
      data: [
        { id: tenantA, slug: tenantA, name: 'Tenant A' },
        { id: tenantB, slug: tenantB, name: 'Tenant B' }
      ]
    });
    const poolA = await prisma.inventoryPool.create({ data: { tenantId: tenantA, name: 'A', normalizedName: 'a' } });
    const poolB = await prisma.inventoryPool.create({ data: { tenantId: tenantB, name: 'B', normalizedName: 'b' } });
    branchA = await prisma.branch.create({ data: { tenantId: tenantA, name: 'Principal', normalizedName: 'principal', code: 'PRINCIPAL', isPrimary: true, defaultInventoryPoolId: poolA.id } });
    branchB = await prisma.branch.create({ data: { tenantId: tenantB, name: 'Principal', normalizedName: 'principal', code: 'PRINCIPAL', isPrimary: true, defaultInventoryPoolId: poolB.id } });
  });

  afterAll(async () => {
    try {
      await prisma.saleDetail.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.sale.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.inventoryPoolStock.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.store.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.refreshSession.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.tenantModuleSetting.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.branch.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.inventoryPool.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    } catch (error) {
      if ((error as { name?: string }).name !== 'PrismaClientInitializationError') {
        throw error;
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('resuelve current_tenant_id desde el setting transaccional de Postgres', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantA}, true)`;
      return tx.$queryRaw<Array<{ tenant_id: string }>>`SELECT public.current_tenant_id() AS tenant_id`;
    });

    expect(rows[0]?.tenant_id).toBe(tenantA);
  });

  it('tiene politicas RLS para tablas tenant-owned', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string; policyname: string }>>`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('Tenant', 'TenantModuleSetting', 'User', 'Store', 'Sale', 'SaleDetail')
      ORDER BY tablename
    `;

    expect(rows.map((row) => `${row.tablename}:${row.policyname}`)).toEqual([
      'Sale:Sale_current_tenant',
      'SaleDetail:SaleDetail_current_tenant',
      'Store:Store_current_tenant',
      'Tenant:Tenant_current_tenant',
      'TenantModuleSetting:TenantModuleSetting_current_tenant',
      'User:User_current_tenant'
    ]);
  });

  it('rechaza una venta que cruza empleado y vendedor de tenants diferentes', async () => {
    const employee = await createUser(tenantA, 'employee');
    const seller = await createUser(tenantB, 'seller');
    await prisma.branchMembership.create({ data: { tenantId: tenantA, branchId: branchA.id, userId: employee.id } });

    await expect(prisma.sale.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        employeeId: employee.id,
        sellerId: seller.id,
        amount: '100.00',
        amountCash: '100.00',
        amountTransfer: '0.00',
        paymentMethod: 'CASH',
        deliveryPay: '0.00',
        perfumeCount: 1
      }
    })).rejects.toThrow(/scope mismatch|tenant boundary/i);
  });

  it('rechaza detalles de venta con producto de otro tenant', async () => {
    const employee = await createUser(tenantA, 'detail-employee');
    await prisma.branchMembership.create({ data: { tenantId: tenantA, branchId: branchA.id, userId: employee.id } });
    const store = await prisma.store.create({
      data: {
        tenantId: tenantB,
        name: `${runId}-producto-b`,
        purchasePrice: '10.00',
        salePrice: '20.00',
        stock: 10
      }
    });
    const sale = await prisma.sale.create({
      data: {
        tenantId: tenantA,
        branchId: branchA.id,
        employeeId: employee.id,
        amount: '100.00',
        amountCash: '100.00',
        amountTransfer: '0.00',
        paymentMethod: 'CASH',
        deliveryPay: '0.00',
        perfumeCount: 1
      }
    });

    await expect(prisma.saleDetail.create({
      data: {
        tenantId: tenantA,
        saleId: sale.id,
        storeId: store.id,
        inventoryPoolId: branchA.defaultInventoryPoolId,
        quantity: 1,
        unitPrice: '20.00',
        purchaseUnitPrice: '10.00'
      }
    })).rejects.toThrow(/tenant mismatch|tenant boundary/i);
  });
});

async function createUser(tenantId: string, prefix: string) {
  const id = `${prefix}-${randomUUID()}`;
  return prisma.user.create({
    data: {
      id,
      tenantId,
      name: id,
      email: `${id}@example.test`,
      passwordHash: 'not-used',
      status: 'ACTIVE'
    }
  });
}
