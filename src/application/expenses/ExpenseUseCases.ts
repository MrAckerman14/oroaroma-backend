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
    void actor;
    return this.prisma.expenseCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });
  }

  async createCategory(actor: AuthenticatedUser, name: string) {
    const normalizedName = this.normalizeName(name);
    void actor;
    const existing = await this.prisma.expenseCategory.findUnique({ where: { normalizedName } });
    if (existing && !existing.deletedAt) throw new ConflictError('Ya existe una categoría con ese nombre');
    if (existing) {
      return this.prisma.expenseCategory.update({
        where: { id: existing.id },
        data: { name: name.trim(), deletedAt: null }
      });
    }
    return this.prisma.expenseCategory.create({
      data: { name: name.trim(), normalizedName }
    });
  }

  async list(actor: AuthenticatedUser, input: Range & Pagination) {
    const date = this.dateFilter(input);
    void actor;
    const where = { deletedAt: null, ...(date ? { date } : {}) };
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

  async create(actor: AuthenticatedUser, input: CreateMovementInput) {
    const category = await this.resolveCategory(actor, input);
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.expenseControl.create({
        data: {
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

  async update(actor: AuthenticatedUser, id: string, input: MovementInput) {
    const current = await this.findMovement(actor, id);
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

  async remove(actor: AuthenticatedUser, id: string) {
    const current = await this.findMovement(actor, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.expenseControl.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
      await this.audit(tx, actor, 'delete', 'expense-control', current.id);
    });
  }

  async preview(actor: AuthenticatedUser, range: Range) {
    const date = this.dateFilter(range);
    const movements = await this.prisma.expenseControl.findMany({
      where: { deletedAt: null, ...(date ? { date } : {}) },
      select: { amount: true, type: true, category: { select: { name: true } } }
    });
    return this.summarize(movements, range);
  }

  async createReport(actor: AuthenticatedUser, input: { name: string; note?: string | undefined; fromDate?: string | undefined; toDate?: string | undefined }) {
    if (!input.fromDate || !input.toDate) throw new ValidationAppError('Las fechas desde y hasta son requeridas');
    const range = { from: input.fromDate, to: input.toDate };
    const preview = await this.preview(actor, range);
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.create({
        data: {
          name: input.name.trim(),
          note: input.note?.trim() || null,
          fromDate: this.dateOnly(range.from),
          toDate: this.dateOnly(range.to),
          totalIncome: preview.totalIncome,
          totalExpense: preview.totalExpense,
          balance: preview.balance,
          createdById: actor.id,
          details: { create: preview.categories }
        },
        include: { details: true, creator: { select: { id: true, name: true } } }
      });
      await this.audit(tx, actor, 'create', 'expense-report', report.id, { fromDate: range.from, toDate: range.to });
      return report;
    });
  }

  async listReports(actor: AuthenticatedUser, input: Range & Pagination) {
    const createdAt = buildCreatedAtFilter(parseDateRange(input));
    void actor;
    const where = { deletedAt: null, ...(createdAt ? { createdAt } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.expenseReport.findMany({ where, include: { details: true }, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      this.prisma.expenseReport.count({ where })
    ]);
    return this.paginated(items, total, input);
  }

  async reportDetail(actor: AuthenticatedUser, id: string) {
    const report = await this.prisma.expenseReport.findFirst({
      where: { id, deletedAt: null },
      include: { details: { orderBy: { categoryName: 'asc' } }, creator: { select: { id: true, name: true } } }
    });
    if (!report) throw new NotFoundError('Reporte de gastos no encontrado');
    return report;
  }

  async updateReport(actor: AuthenticatedUser, id: string, input: { name?: string | undefined; note?: string | null | undefined }) {
    await this.reportDetail(actor, id);
    return this.prisma.expenseReport.update({
      where: { id },
      data: { ...(input.name ? { name: input.name.trim() } : {}), ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}) },
      include: { details: true }
    });
  }

  async removeReport(actor: AuthenticatedUser, id: string) {
    await this.reportDetail(actor, id);
    await this.prisma.expenseReport.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findMovement(actor: AuthenticatedUser, id: string) {
    const movement = await this.prisma.expenseControl.findFirst({ where: { id, deletedAt: null } });
    if (!movement) throw new NotFoundError('Movimiento no encontrado');
    return movement;
  }

  private async resolveCategory(actor: AuthenticatedUser, input: Pick<MovementInput, 'categoryId' | 'categoryName'>) {
    if (input.categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({ where: { id: input.categoryId, deletedAt: null } });
      if (!category) throw new ValidationAppError('La categoría no existe');
      return category;
    }
    if (!input.categoryName) throw new ValidationAppError('La categoría es requerida');
    const normalizedName = this.normalizeName(input.categoryName);
    void actor;
    const existing = await this.prisma.expenseCategory.findUnique({ where: { normalizedName } });
    if (existing?.deletedAt) return this.prisma.expenseCategory.update({ where: { id: existing.id }, data: { deletedAt: null } });
    return existing ?? this.prisma.expenseCategory.create({ data: { name: input.categoryName.trim(), normalizedName } });
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
    return tx.auditLog.create({ data: { actorId: actor.id, action, resource, resourceId, ...(metadata ? { metadata } : {}) } });
  }
}
