import { Prisma, type ExpenseType, type PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, parseDateRange } from '../../shared/utils/dateRange.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

type Range = { from?: string | undefined; to?: string | undefined };
type Pagination = { page: number; pageSize: number };
type MovementInput = {
  amount?: number | undefined;
  type?: ExpenseType | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  date?: string | undefined;
  description?: string | undefined;
};
type CreateMovementInput = Omit<MovementInput, 'amount' | 'type' | 'date'> & {
  amount: number;
  type: ExpenseType;
  date: string;
};

export class ExpenseUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  listCategories(actor: AuthenticatedUser) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });
  }

  async createCategory(actor: AuthenticatedUser, name: string) {
    const normalizedName = this.normalizeName(name);
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { tenantId_normalizedName: { tenantId: actor.tenantId, normalizedName } }
    });
    if (existing && !existing.deletedAt) throw new ConflictError('Ya existe una categoría con ese nombre');
    if (existing) {
      return this.prisma.expenseCategory.update({
        where: { id: existing.id },
        data: { name: name.trim(), deletedAt: null }
      });
    }
    return this.prisma.expenseCategory.create({
      data: { tenantId: actor.tenantId, name: name.trim(), normalizedName }
    });
  }

  async removeCategory(actor: AuthenticatedUser, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({ where: { id, tenantId: actor.tenantId, deletedAt: null } });
    if (!category) throw new NotFoundError('Categoría no encontrada');
    if (category.isSystem) throw new ValidationAppError('Las categorías predeterminadas no se pueden eliminar');
    const movements = await this.prisma.expenseControl.count({ where: { categoryId: id, tenantId: actor.tenantId, deletedAt: null } });
    if (movements > 0) throw new ConflictError('No se puede eliminar una categoría que tiene movimientos');
    await this.prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async list(actor: AuthenticatedUser, branchIdOrInput: string | (Range & Pagination), explicitInput?: Range & Pagination) {
    const branchId = typeof branchIdOrInput === 'string' ? branchIdOrInput : undefined;
    const input = typeof branchIdOrInput === 'string' ? explicitInput! : branchIdOrInput;
    const date = this.dateFilter(input);
    const where = { tenantId: actor.tenantId, ...(branchId ? { branchId } : {}), deletedAt: null, ...(date ? { date } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.expenseControl.findMany({
        where,
        include: { category: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.expenseControl.count({ where })
    ]);
    return this.paginated(items, total, input);
  }

  async create(actor: AuthenticatedUser, branchIdOrInput: string | CreateMovementInput, explicitInput?: CreateMovementInput) {
    const branchId = typeof branchIdOrInput === 'string' ? branchIdOrInput : undefined;
    const input = typeof branchIdOrInput === 'string' ? explicitInput! : branchIdOrInput;
    const category = await this.resolveCategory(actor, input);
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.expenseControl.create({
        data: {
          tenantId: actor.tenantId,
          ...(branchId ? { branchId } : {}),
          amount: input.amount,
          type: input.type,
          categoryId: category.id,
          date: this.dateOnly(input.date),
          description: input.description?.trim() || null,
          createdById: actor.id
        },
        include: { category: true, creator: { select: { id: true, name: true } } }
      });
      await this.audit(tx, actor, 'create', 'expense-control', movement.id, { type: movement.type, categoryId: movement.categoryId });
      return movement;
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: MovementInput, branchId?: string) {
    const current = await this.findMovement(actor, id, branchId);
    const category = input.categoryId || input.categoryName ? await this.resolveCategory(actor, input) : null;
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.expenseControl.update({
        where: { id: current.id },
        data: {
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(category ? { categoryId: category.id } : {}),
          ...(input.date ? { date: this.dateOnly(input.date) } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() || null } : {})
        },
        include: { category: true, creator: { select: { id: true, name: true } } }
      });
      await this.audit(tx, actor, 'update', 'expense-control', movement.id, { changedFields: Object.keys(input) });
      return movement;
    });
  }

  async remove(actor: AuthenticatedUser, id: string, branchId?: string) {
    const current = await this.findMovement(actor, id, branchId);
    await this.prisma.$transaction(async (tx) => {
      await tx.expenseControl.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
      await this.audit(tx, actor, 'delete', 'expense-control', current.id);
    });
  }

  async preview(actor: AuthenticatedUser, branchIdOrRange: string | Range, explicitRange?: Range) {
    const branchId = typeof branchIdOrRange === 'string' ? branchIdOrRange : undefined;
    const range = typeof branchIdOrRange === 'string' ? explicitRange! : branchIdOrRange;
    const date = this.dateFilter(range);
    const movements = await this.prisma.expenseControl.findMany({
      where: { tenantId: actor.tenantId, ...(branchId ? { branchId } : {}), deletedAt: null, ...(date ? { date } : {}) },
      select: { amount: true, type: true, category: { select: { name: true } } }
    });
    return this.summarize(movements, range);
  }

  async createReport(actor: AuthenticatedUser, branchIdOrInput: string | { name: string; note?: string | undefined; fromDate?: string | undefined; toDate?: string | undefined }, explicitInput?: { name: string; note?: string | undefined; fromDate?: string | undefined; toDate?: string | undefined }) {
    const branchId = typeof branchIdOrInput === 'string' ? branchIdOrInput : undefined;
    const input = typeof branchIdOrInput === 'string' ? explicitInput! : branchIdOrInput;
    if (!input.fromDate || !input.toDate) throw new ValidationAppError('Las fechas desde y hasta son requeridas');
    const range = { from: input.fromDate, to: input.toDate };
    const preview = branchId ? await this.preview(actor, branchId, range) : await this.preview(actor, range);
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.create({
        data: {
          tenantId: actor.tenantId,
          ...(branchId ? { branchId } : {}),
          name: input.name.trim(),
          note: input.note?.trim() || null,
          fromDate: this.dateOnly(range.from),
          toDate: this.dateOnly(range.to),
          totalIncome: preview.totalIncome,
          totalExpense: preview.totalExpense,
          balance: preview.balance,
          createdById: actor.id,
          details: { create: preview.categories.map((category) => ({ tenantId: actor.tenantId, ...category })) }
        },
        include: { details: true, creator: { select: { id: true, name: true } } }
      });
      await this.audit(tx, actor, 'create', 'expense-report', report.id, { fromDate: range.from, toDate: range.to });
      return report;
    });
  }

  async listReports(actor: AuthenticatedUser, branchIdOrInput: string | (Range & Pagination), explicitInput?: Range & Pagination) {
    const branchId = typeof branchIdOrInput === 'string' ? branchIdOrInput : undefined;
    const input = typeof branchIdOrInput === 'string' ? explicitInput! : branchIdOrInput;
    const createdAt = buildCreatedAtFilter(parseDateRange(input));
    const where = { tenantId: actor.tenantId, ...(branchId ? { branchId } : {}), deletedAt: null, ...(createdAt ? { createdAt } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.expenseReport.findMany({ where, include: { details: true }, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      this.prisma.expenseReport.count({ where })
    ]);
    return this.paginated(items, total, input);
  }

  async reportDetail(actor: AuthenticatedUser, id: string, branchId?: string) {
    const report = await this.prisma.expenseReport.findFirst({
      where: { id, tenantId: actor.tenantId, ...(branchId ? { branchId } : {}), deletedAt: null },
      include: { details: { orderBy: { categoryName: 'asc' } }, creator: { select: { id: true, name: true } } }
    });
    if (!report) throw new NotFoundError('Reporte de gastos no encontrado');
    return report;
  }

  async updateReport(actor: AuthenticatedUser, id: string, input: { name?: string | undefined; note?: string | null | undefined }, branchId?: string) {
    await this.reportDetail(actor, id, branchId);
    return this.prisma.expenseReport.update({
      where: { id },
      data: { ...(input.name ? { name: input.name.trim() } : {}), ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}) },
      include: { details: true }
    });
  }

  async removeReport(actor: AuthenticatedUser, id: string, branchId?: string) {
    await this.reportDetail(actor, id, branchId);
    await this.prisma.expenseReport.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findMovement(actor: AuthenticatedUser, id: string, branchId?: string) {
    const movement = await this.prisma.expenseControl.findFirst({ where: { id, tenantId: actor.tenantId, ...(branchId ? { branchId } : {}), deletedAt: null } });
    if (!movement) throw new NotFoundError('Movimiento no encontrado');
    return movement;
  }

  private async resolveCategory(actor: AuthenticatedUser, input: Pick<MovementInput, 'categoryId' | 'categoryName'>) {
    if (input.categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({ where: { id: input.categoryId, tenantId: actor.tenantId, deletedAt: null } });
      if (!category) throw new ValidationAppError('La categoría no existe en esta empresa');
      return category;
    }
    if (!input.categoryName) throw new ValidationAppError('La categoría es requerida');
    const normalizedName = this.normalizeName(input.categoryName);
    const existing = await this.prisma.expenseCategory.findUnique({ where: { tenantId_normalizedName: { tenantId: actor.tenantId, normalizedName } } });
    if (existing?.deletedAt) return this.prisma.expenseCategory.update({ where: { id: existing.id }, data: { deletedAt: null } });
    return existing ?? this.prisma.expenseCategory.create({ data: { tenantId: actor.tenantId, name: input.categoryName.trim(), normalizedName } });
  }

  private summarize(movements: Array<{ amount: Prisma.Decimal; type: ExpenseType; category: { name: string } }>, range: Range) {
    const categories = new Map<string, { categoryName: string; income: Prisma.Decimal; expense: Prisma.Decimal; balance: Prisma.Decimal }>();
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    for (const movement of movements) {
      const row = categories.get(movement.category.name) ?? { categoryName: movement.category.name, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0), balance: new Prisma.Decimal(0) };
      if (movement.type === 'INCOME') { row.income = row.income.plus(movement.amount); totalIncome = totalIncome.plus(movement.amount); } else { row.expense = row.expense.plus(movement.amount); totalExpense = totalExpense.plus(movement.amount); }
      row.balance = row.income.minus(row.expense);
      categories.set(movement.category.name, row);
    }
    return { fromDate: range.from, toDate: range.to, totalIncome, totalExpense, balance: totalIncome.minus(totalExpense), categories: [...categories.values()] };
  }

  private dateFilter(range: Range) { return buildCreatedAtFilter(parseDateRange(range)); }
  private dateOnly(value: string) { return new Date(`${value}T12:00:00.000Z`); }
  private normalizeName(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  private paginated<T>(items: T[], total: number, input: Pagination) { return { items, pagination: { ...input, total, totalPages: Math.ceil(total / input.pageSize) } }; }
  private audit(tx: Prisma.TransactionClient, actor: AuthenticatedUser, action: string, resource: string, resourceId: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, action, resource, resourceId, ...(metadata ? { metadata } : {}) } });
  }
}
