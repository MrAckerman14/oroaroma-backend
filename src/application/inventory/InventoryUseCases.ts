import { Prisma, type PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, currentCalendarDayRange, dateRangeOrCurrentDay, parseDateRange } from '../../shared/utils/dateRange.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export interface InventoryRangeInput {
  from?: string | undefined;
  to?: string | undefined;
  name?: string | undefined;
  note?: string | null | undefined;
}

export interface PaginatedInventoryRangeInput extends InventoryRangeInput {
  page: number;
  pageSize: number;
}

export interface InventoryPreviewInput {
  page: number;
  pageSize: number;
}

export interface InventoryDetailInput {
  page: number;
  pageSize: number;
}

export class InventoryUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async review(input: InventoryPreviewInput) {
    const snapshot = await this.inventorySnapshot();
    const start = (input.page - 1) * input.pageSize;
    const items = snapshot.products.slice(start, start + input.pageSize);

    return {
      items,
      products: items,
      totals: snapshot.totals,
      pagination: this.pagination(input, snapshot.products.length)
    };
  }

  private async inventorySnapshot() {
    const products = await this.prisma.store.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    const enriched = products.map((product) => ({
      ...product,
      product: product.name,
      price: product.purchasePrice,
      inventoryValue: product.purchasePrice.mul(product.stock)
    }));

    const totals = enriched.reduce((acc, product) => {
      acc.totalProducts += product.stock;
      acc.totalInventoryValue = acc.totalInventoryValue.plus(product.inventoryValue);
      return acc;
    }, {
      totalProducts: 0,
      totalInventoryValue: new Prisma.Decimal(0)
    });

    return { products: enriched, totals };
  }

  async save(actor: AuthenticatedUser, input: InventoryRangeInput) {
    const range = parseDateRange(input);
    const fallbackRange = currentCalendarDayRange();
    const from = range.from ?? fallbackRange.from;
    const to = range.to ?? fallbackRange.to;

    const snapshot = await this.inventorySnapshot();

    const report = await this.prisma.inventoryReport.create({
      data: {
        fromDate: from,
        toDate: to,
        name: input.name?.trim() || `Reporte de inventario ${this.formatDateOnly(new Date())}`,
        note: input.note?.trim() || null,
        createdById: actor.id,
        totalProducts: snapshot.totals.totalProducts,
        totalInventoryValue: snapshot.totals.totalInventoryValue,
        details: {
          create: snapshot.products.map((product) => ({
            productId: product.id,
            productName: product.name,
            productDescription: product.description,
            purchasePrice: product.purchasePrice,
            stock: product.stock,
            inventoryValue: product.inventoryValue
          }))
        }
      },
      include: {
        creator: { select: { id: true, name: true } },
        details: true
      }
    });

    return this.presentReport(report);
  }

  async list(actor: AuthenticatedUser, input: PaginatedInventoryRangeInput) {
    const range = dateRangeOrCurrentDay(input);
    const createdAt = buildCreatedAtFilter(range);
    const canGlobal = this.canReadGlobalInventoryReports(actor);
    if (!canGlobal) {
      throw new ForbiddenError('Permiso requerido para leer reportes de inventario');
    }

    const where = {
      deletedAt: null,
      ...(createdAt ? { createdAt } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.inventoryReport.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          _count: { select: { details: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.inventoryReport.count({ where })
    ]);

    return this.paginated(items.map((report) => this.presentReport(report)), total, input);
  }

  async detail(id: string, actor: AuthenticatedUser, input: InventoryDetailInput) {
    const canGlobal = this.canReadGlobalInventoryReports(actor);
    if (!canGlobal) {
      throw new ForbiddenError('Permiso requerido para leer reportes de inventario');
    }
    const where = {
      id,
      deletedAt: null
    };
    const [report, details, totalDetails] = await Promise.all([
      this.prisma.inventoryReport.findFirst({
        where,
        include: {
          creator: { select: { id: true, name: true } }
        }
      }),
      this.prisma.inventoryReportDetail.findMany({
        where: { inventoryReportId: id },
        orderBy: { productName: 'asc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.inventoryReportDetail.count({
        where: { inventoryReportId: id }
      })
    ]);

    if (!report) throw new NotFoundError('Reporte de inventario no encontrado');

    return this.presentReport({
      ...report,
      details: details.map((detail) => this.presentDetail(detail)),
      detailItems: details.map((detail) => this.presentDetail(detail)),
      detailsPagination: this.pagination(input, totalDetails),
      summary: this.reportSummary(report),
      generalSummary: this.reportSummary(report)
    });
  }

  async softDelete(id: string) {
    const report = await this.prisma.inventoryReport.findFirst({
      where: { id, deletedAt: null }
    });
    if (!report) throw new NotFoundError('Reporte de inventario no encontrado');

    await this.prisma.inventoryReport.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async update(id: string, input: { name?: string | undefined; note?: string | null | undefined }) {
    const report = await this.prisma.inventoryReport.findFirst({
      where: { id, deletedAt: null }
    });
    if (!report) throw new NotFoundError('Reporte de inventario no encontrado');

    return this.prisma.inventoryReport.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {})
      },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { details: true } }
      }
    }).then((report) => this.presentReport(report));
  }

  private presentReport<T extends {
    id: string;
    createdAt: Date;
    totalProducts: number;
    totalInventoryValue: Prisma.Decimal;
    creator?: { id: string; name: string } | null;
  }>(report: T) {
    return {
      ...report,
      date: report.createdAt,
      reportDate: report.createdAt,
      createdDate: report.createdAt,
      inventoryValue: report.totalInventoryValue,
      summary: this.reportSummary(report),
      generalSummary: this.reportSummary(report)
    };
  }

  private presentDetail(detail: {
    id: string;
    inventoryReportId: string;
    productId: string;
    productName: string;
    productDescription: string | null;
    purchasePrice: Prisma.Decimal;
    stock: number;
    inventoryValue: Prisma.Decimal;
  }) {
    return {
      ...detail,
      product: detail.productName,
      name: detail.productName,
      price: detail.purchasePrice,
      value: detail.inventoryValue
    };
  }

  private reportSummary(report: {
    totalProducts: number;
    totalInventoryValue: Prisma.Decimal;
  }) {
    return {
      totalProducts: report.totalProducts,
      totalInventoryValue: report.totalInventoryValue,
      inventoryValue: report.totalInventoryValue
    };
  }

  private formatDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  async legacyDetail(id: string, actor: AuthenticatedUser) {
    const canGlobal = this.canReadGlobalInventoryReports(actor);
    if (!canGlobal) {
      throw new ForbiddenError('Permiso requerido para leer reportes de inventario');
    }

    const report = await this.prisma.inventoryReport.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: {
        creator: { select: { id: true, name: true } },
        details: {
          orderBy: { productName: 'asc' }
        }
      }
    });

    if (!report) throw new NotFoundError('Reporte de inventario no encontrado');
    return this.presentReport({
      ...report,
      details: report.details.map((detail) => this.presentDetail(detail)),
      detailItems: report.details.map((detail) => this.presentDetail(detail)),
      summary: this.reportSummary(report),
      generalSummary: this.reportSummary(report)
    });
  }

  private canReadGlobalInventoryReports(actor: AuthenticatedUser) {
    return actor.permissions.some((permission) => {
      return permission.key === 'inventory-reports:read:global';
    });
  }

  private paginated<T>(items: T[], total: number, pagination: { page: number; pageSize: number }) {
    return {
      items,
      pagination: this.pagination(pagination, total)
    };
  }

  private pagination(pagination: { page: number; pageSize: number }, total: number) {
    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize)
    };
  }
}
