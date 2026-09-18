import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpenseUseCases } from '../../application/expenses/ExpenseUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
let actor: AuthenticatedUser;
let category: { id: string };

describeDb('expense control and reports', () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: 'Expense admin', email: `expense-${suffix}@test.local`, passwordHash: 'not-used' }
    });
    actor = { id: user.id, email: user.email, name: user.name, status: 'ACTIVE', statusLabel: 'Activo', roles: [], permissions: [] };
    category = await prisma.expenseCategory.create({
      data: { name: `Publicidad ${suffix}`, normalizedName: `publicidad-${suffix}` }
    });
  });

  afterAll(async () => {
    await prisma.expenseReportDetail.deleteMany({ where: { report: { createdById: actor.id } } });
    await prisma.expenseReport.deleteMany({ where: { createdById: actor.id } });
    await prisma.expenseControl.deleteMany({ where: { createdById: actor.id } });
    await prisma.expenseCategory.deleteMany({ where: { id: category.id } });
    await prisma.auditLog.deleteMany({ where: { actorId: actor.id } });
    await prisma.user.delete({ where: { id: actor.id } });
    await prisma.$disconnect();
  });

  it('creates and lists movements in the requested date range', async () => {
    const useCases = new ExpenseUseCases(prisma);
    await useCases.create(actor, { amount: 1500, type: 'EXPENSE', categoryId: category.id, date: '2026-09-17', description: 'Campaña' });
    const result = await useCases.list(actor, { from: '2026-09-17', to: '2026-09-17', page: 1, pageSize: 20 });
    expect(result.items.some((item) => item.createdById === actor.id)).toBe(true);
  });

  it('keeps report snapshots immutable when a movement changes', async () => {
    const useCases = new ExpenseUseCases(prisma);
    const movement = await useCases.create(actor, { amount: 250, type: 'INCOME', categoryName: `Ingreso ${suffix}`, date: '2026-09-18' });
    const report = await useCases.createReport(actor, { name: 'Cierre de prueba', fromDate: '2026-09-18', toDate: '2026-09-18' });
    await useCases.update(actor, movement.id, { amount: 999 });
    const detail = await useCases.reportDetail(actor, report.id);
    expect(detail.totalIncome.toString()).toBe('250');
  });

  it('uses soft deletion and preserves audit history', async () => {
    const useCases = new ExpenseUseCases(prisma);
    const movement = await useCases.create(actor, { amount: 75, type: 'EXPENSE', categoryId: category.id, date: '2026-09-19' });
    await useCases.remove(actor, movement.id);
    expect(await prisma.expenseControl.findUnique({ where: { id: movement.id } })).toMatchObject({ deletedAt: expect.any(Date) });
    expect(await prisma.auditLog.count({ where: { actorId: actor.id, resourceId: movement.id } })).toBeGreaterThanOrEqual(2);
  });

  it('deletes only unused custom categories', async () => {
    const useCases = new ExpenseUseCases(prisma);
    const system = await prisma.expenseCategory.findFirstOrThrow({ where: { isSystem: true } });
    const custom = await useCases.createCategory(actor, `Temporal ${suffix}`);
    await useCases.removeCategory(actor, custom.id);
    expect(await prisma.expenseCategory.findUnique({ where: { id: custom.id } })).toMatchObject({ deletedAt: expect.any(Date) });
    await expect(useCases.removeCategory(actor, system.id)).rejects.toThrow('predeterminadas');
    await expect(useCases.removeCategory(actor, category.id)).rejects.toThrow('tiene movimientos');
  });
});
