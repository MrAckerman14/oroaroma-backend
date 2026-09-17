import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpenseUseCases } from '../../application/expenses/ExpenseUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
const tenantA = `expense-a-${suffix}`;
const tenantB = `expense-b-${suffix}`;
let actorA: AuthenticatedUser;
let categoryA: { id: string };
let categoryB: { id: string };

describeDb('expense control tenant isolation and reports', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({ data: [
      { id: tenantA, slug: tenantA, name: 'Expense tenant A' },
      { id: tenantB, slug: tenantB, name: 'Expense tenant B' }
    ] });
    const user = await prisma.user.create({ data: { tenantId: tenantA, name: 'Admin A', email: `${tenantA}@test.local`, passwordHash: 'not-used' } });
    actorA = { id: user.id, tenantId: tenantA, email: user.email, name: user.name, status: 'ACTIVE', statusLabel: 'Activo', roles: [], permissions: [] };
    categoryA = await prisma.expenseCategory.create({ data: { tenantId: tenantA, name: 'Publicidad', normalizedName: 'publicidad' } });
    categoryB = await prisma.expenseCategory.create({ data: { tenantId: tenantB, name: 'Privado B', normalizedName: 'privado b' } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.expenseReportDetail.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.expenseReport.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.expenseControl.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.expenseCategory.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  });

  it('crea y lista movimientos únicamente dentro del tenant', async () => {
    const useCases = new ExpenseUseCases(prisma);
    await useCases.create(actorA, { amount: 1500, type: 'EXPENSE', categoryId: categoryA.id, date: '2026-09-17', description: 'Campaña' });
    const result = await useCases.list(actorA, { from: '2026-09-17', to: '2026-09-17', page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.tenantId).toBe(tenantA);
  });

  it('rechaza categorías pertenecientes a otra empresa', async () => {
    const useCases = new ExpenseUseCases(prisma);
    await expect(useCases.create(actorA, { amount: 10, type: 'EXPENSE', categoryId: categoryB.id, date: '2026-09-17' }))
      .rejects.toThrow('La categoría no existe en esta empresa');

    await expect(prisma.expenseControl.create({
      data: { tenantId: tenantA, amount: 10, type: 'EXPENSE', categoryId: categoryB.id, date: new Date(), createdById: actorA.id }
    })).rejects.toThrow(/tenant boundary/i);
  });

  it('tiene políticas RLS en todas las tablas financieras nuevas', async () => {
    const policies = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('ExpenseCategory', 'ExpenseControl', 'ExpenseReport', 'ExpenseReportDetail')
      ORDER BY tablename
    `;
    expect(policies.map((row) => row.tablename)).toEqual(['ExpenseCategory', 'ExpenseControl', 'ExpenseReport', 'ExpenseReportDetail']);
  });

  it('mantiene el reporte histórico aunque el movimiento cambie después', async () => {
    const useCases = new ExpenseUseCases(prisma);
    const movement = await useCases.create(actorA, { amount: 250, type: 'INCOME', categoryName: 'Ingreso prueba', date: '2026-09-18' });
    const report = await useCases.createReport(actorA, { name: 'Cierre de prueba', fromDate: '2026-09-18', toDate: '2026-09-18' });
    await useCases.update(actorA, movement.id, { amount: 999 });
    const detail = await useCases.reportDetail(actorA, report.id);
    expect(detail.totalIncome.toString()).toBe('250');
    expect(detail.details[0]?.income.toString()).toBe('250');
  });

  it('oculta con borrado lógico sin destruir auditoría ni reportes', async () => {
    const useCases = new ExpenseUseCases(prisma);
    const movement = await useCases.create(actorA, { amount: 75, type: 'EXPENSE', categoryId: categoryA.id, date: '2026-09-19' });
    await useCases.remove(actorA, movement.id);
    const result = await useCases.list(actorA, { from: '2026-09-19', to: '2026-09-19', page: 1, pageSize: 20 });
    expect(result.items).toEqual([]);
    expect(await prisma.auditLog.count({ where: { tenantId: tenantA, resourceId: movement.id } })).toBeGreaterThanOrEqual(2);
  });
});
