import { Prisma, type CashClosureStatus, type PrismaClient, type SaleStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, currentCalendarDayRange, dateRangeOrCurrentDay, parseDateRange } from '../../shared/utils/dateRange.js';
import { cashClosureStatusLabels, labelFromMap, paymentMethodLabels, saleStatusLabels } from '../../shared/utils/spanishLabels.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export interface DateRangeInput {
  from?: string | undefined;
  to?: string | undefined;
}

export interface CreateCashClosureInput extends DateRangeInput {
  saleIds?: string[] | undefined;
}

export interface PaginatedDateRangeInput extends DateRangeInput {
  page: number;
  pageSize: number;
}

export interface ClosureDetailsInput {
  page: number;
  pageSize: number;
}

type CashClosureForPresentation = {
  id: string;
  createdById: string;
  fromDate: Date;
  toDate: Date;
  totalCash: Prisma.Decimal;
  totalTransfer: Prisma.Decimal;
  totalSale: Prisma.Decimal;
  totalMessengerCost: Prisma.Decimal;
  netTotal: Prisma.Decimal;
  totalPerfumes: number;
  pendingMoney: Prisma.Decimal;
  pendingMessengerPay: Prisma.Decimal;
  internalSale: Prisma.Decimal;
  generalSale: Prisma.Decimal;
  status: CashClosureStatus;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  creator?: {
    id: string;
    name: string;
    roleAssignments?: Array<{
      role: {
        id: string;
        key: string;
        name: string;
      };
    }>;
  };
};

export class ReportUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async cashReconciliation(actor: AuthenticatedUser, input: CreateCashClosureInput) {
    const saleIds = this.validateRequestedSaleIds(input.saleIds);
    const where: Prisma.SaleWhereInput = saleIds?.length
      ? this.closableSalesByIdsWhere(actor, saleIds)
      : this.reconciliationSalesWhere(actor, input);

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        messenger: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        details: { select: { quantity: true, purchaseUnitPrice: true, unitPrice: true } }
      }
    });

    if (saleIds?.length && sales.length !== saleIds.length) {
      throw new ValidationAppError('Una o mas ventas cargadas no estan disponibles para cierre');
    }

    return this.cashSummary(actor, sales);
  }

  async createCashClosure(actor: AuthenticatedUser, input: CreateCashClosureInput) {
    const saleIds = this.validateRequestedSaleIds(input.saleIds);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sales = input.saleIds?.length
          ? await this.salesForClosureByIds(tx, actor, saleIds ?? [])
          : await this.salesForClosureByRange(tx, actor, input);

        const range = this.closureRange(input, sales);
        const from = range.from;
        const to = range.to;

        if (!sales.length) {
          throw new ValidationAppError('No hay ventas disponibles para cierre');
        }

        if (saleIds?.length && sales.length !== saleIds.length) {
          throw new ValidationAppError('Una o mas ventas cargadas no estan disponibles para cierre');
        }

        if (!from || !to) {
          throw new ValidationAppError('La fecha desde y la fecha hasta son requeridas');
        }

        const totals = this.cashClosureTotals(sales);
        const pendingTotals = await this.pendingTotalsForClosure(tx, actor, { from, to });

        return tx.cashClosure.create({
          data: {
            createdById: actor.id,
            fromDate: from,
            toDate: to,
            totalCash: totals.totalCash,
            totalTransfer: totals.totalTransfer,
            totalSale: totals.totalSale,
            totalMessengerCost: totals.totalMessengerCost,
            netTotal: totals.totalCash.minus(totals.totalMessengerCost),
            totalPerfumes: totals.totalPerfumes,
            pendingMoney: pendingTotals.pendingMoney,
            pendingMessengerPay: pendingTotals.pendingMessengerPay,
            internalSale: totals.internalSale,
            generalSale: totals.generalSale,
            status: 'PENDING',
            details: {
              create: sales.map((sale) => ({ saleId: sale.id }))
            }
          },
          include: {
            creator: this.creatorInclude(),
            details: true
          }
        }).then((closure) => this.presentCashClosure(closure));
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (this.isCashClosureRaceError(error)) {
        throw new ValidationAppError('El cierre no pudo completarse por una operacion concurrente. Recarga la caja e intenta de nuevo.');
      }

      throw error;
    }
  }

  private async salesForClosureByRange(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    input: CreateCashClosureInput
  ) {
    const range = dateRangeOrCurrentDay(input);
    if (!range.from || !range.to) throw new ValidationAppError('La fecha desde y la fecha hasta son requeridas');

    return tx.sale.findMany({
      where: this.closableSalesWhere(actor, input),
      include: this.saleCalculationInclude()
    });
  }

  private async salesForClosureByIds(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    saleIds: string[]
  ) {
    return tx.sale.findMany({
      where: this.closableSalesByIdsWhere(actor, [...new Set(saleIds)]),
      include: this.saleCalculationInclude()
    });
  }

  private uniqueSaleIds(saleIds: string[]) {
    return [...new Set(saleIds)];
  }

  private validateRequestedSaleIds(saleIds: string[] | undefined) {
    if (!saleIds) return undefined;

    const uniqueSaleIds = this.uniqueSaleIds(saleIds);
    if (saleIds.length !== uniqueSaleIds.length) {
      throw new ValidationAppError('No puedes incluir la misma venta dos veces en un cierre');
    }

    if (uniqueSaleIds.length > env.CASH_CLOSURE_MAX_SALES) {
      throw new ValidationAppError(`No puedes cerrar mas de ${env.CASH_CLOSURE_MAX_SALES} ventas a la vez`);
    }

    return uniqueSaleIds;
  }

  private isCashClosureRaceError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002' || error.code === 'P2034';
    }

    return false;
  }

  private closureRange(input: CreateCashClosureInput, sales: Array<{ createdAt: Date }>) {
    const range = parseDateRange(input);
    if (range.from && range.to) return { from: range.from, to: range.to };

    if (!input.saleIds?.length) return currentCalendarDayRange();

    if (!sales.length) return range;

    const sortedDates = sales
      .map((sale) => sale.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    if (!firstDate || !lastDate) return range;

    const from = range.from ?? firstDate;
    const to = range.to ?? new Date(lastDate.getTime() + 1);

    return { from, to };
  }

  private cashClosureTotals(sales: Array<{
    status: SaleStatus;
    amount: Prisma.Decimal;
    amountCash: Prisma.Decimal;
    amountTransfer: Prisma.Decimal;
    deliveryPay: Prisma.Decimal;
    perfumeCount: number;
    employee: { name: string };
    sellerId: string | null;
    details: Array<{ quantity: number; unitPrice: Prisma.Decimal }>;
  }>) {
    return sales.reduce((acc, sale) => {
      if (sale.status === 'FINALIZED') {
        const saleProductTotal = this.saleProductSaleTotal(sale.details);
        acc.totalSale = acc.totalSale.plus(sale.amount);
        acc.totalCash = acc.totalCash.plus(sale.amountCash);
        acc.totalTransfer = acc.totalTransfer.plus(sale.amountTransfer);
        acc.totalPerfumes += sale.perfumeCount;
        acc.ordersCount += 1;
        acc.totalMessengerCost = acc.totalMessengerCost.plus(sale.deliveryPay);

        if (sale.sellerId) {
          acc.generalSale = acc.generalSale.plus(saleProductTotal);
        } else {
          acc.internalSale = acc.internalSale.plus(sale.amount);
        }
      }

      if (sale.status === 'CANCELLED') {
        acc.totalMessengerCost = acc.totalMessengerCost.plus(sale.deliveryPay);
      }

      return acc;
    }, {
      totalSale: new Prisma.Decimal(0),
      totalCash: new Prisma.Decimal(0),
      totalTransfer: new Prisma.Decimal(0),
      totalMessengerCost: new Prisma.Decimal(0),
      internalSale: new Prisma.Decimal(0),
      generalSale: new Prisma.Decimal(0),
      totalPerfumes: 0,
      ordersCount: 0
    });
  }

  private async cashSummary(actor: AuthenticatedUser, sales: Array<{
    employeeId: string;
    messengerId: string | null;
    sellerId: string | null;
    status: SaleStatus;
    amount: Prisma.Decimal;
    amountCash: Prisma.Decimal;
    amountTransfer: Prisma.Decimal;
    deliveryPay: Prisma.Decimal;
    perfumeCount: number;
    employee: { id: string; name: string; email: string };
    messenger: { id: string; name: string; email: string } | null;
    seller: { id: string; name: string; email: string } | null;
    details: Array<{ quantity: number; purchaseUnitPrice: Prisma.Decimal; unitPrice: Prisma.Decimal }>;
  }>) {
    const totals = this.cashClosureTotals(sales);
    const employeeRows = new Map<string, ReturnType<typeof this.emptyEmployeeSummary>>();
    const sellerRows = new Map<string, ReturnType<typeof this.emptySellerSummary>>();
    const messengerRows = new Map<string, ReturnType<typeof this.emptyMessengerSummary>>();

    for (const sale of sales) {
      if (sale.status === 'FINALIZED') {
        const saleProductTotal = this.saleProductSaleTotal(sale.details);
        const employee = employeeRows.get(sale.employeeId) ?? this.emptyEmployeeSummary(sale.employeeId, sale.employee);
        employee._sum.amount = employee._sum.amount.plus(sale.amount);
        employee._sum.amountCash = employee._sum.amountCash.plus(sale.amountCash);
        employee._sum.amountTransfer = employee._sum.amountTransfer.plus(sale.amountTransfer);
        employee._sum.deliveryPay = employee._sum.deliveryPay.plus(sale.deliveryPay);
        employee._sum.perfumeCount += sale.perfumeCount;
        employee._count.id += 1;
        employee.cash = employee.cash.plus(sale.amountCash);
        employee.transfer = employee.transfer.plus(sale.amountTransfer);
        employee.finalizedDeliveries += 1;
        employee.quantity += sale.perfumeCount;
        employee.shippingCost = employee.shippingCost.plus(sale.deliveryPay);
        if (!sale.sellerId) {
          employee.internalSale = employee.internalSale.plus(sale.amount);
          employee.internalSales = employee.internalSale;
          employee.total = employee.total.plus(sale.amount);
          employee.totalSold = employee.totalSold.plus(sale.amount);
        } else {
          employee.total = employee.total.plus(saleProductTotal);
          employee.totalSold = employee.totalSold.plus(saleProductTotal);
        }
        employee.net = employee.cash.minus(employee.shippingCost);
        employee.netCash = employee.net;
        employeeRows.set(sale.employeeId, employee);

        if (sale.sellerId && sale.seller) {
          const seller = sellerRows.get(sale.sellerId) ?? this.emptySellerSummary(sale.sellerId, sale.seller);
          const perfumeCost = this.saleProductSaleTotal(sale.details);
          seller._sum.amount = seller._sum.amount.plus(sale.amount);
          seller._sum.deliveryPay = seller._sum.deliveryPay.plus(sale.deliveryPay);
          seller._sum.perfumeCount += sale.perfumeCount;
          seller._count.id += 1;
          seller.totalSold = seller.totalSold.plus(sale.amount);
          seller.shippingCost = seller.shippingCost.plus(sale.deliveryPay);
          seller.finalizedDeliveries += 1;
          seller.quantity += sale.perfumeCount;
          seller.perfumeCost = seller.perfumeCost.plus(perfumeCost);
          seller.amountToPay = seller.totalSold.minus(seller.shippingCost).minus(seller.perfumeCost);
          sellerRows.set(sale.sellerId, seller);
        }
      }

      if (sale.status === 'CANCELLED') {
        if (sale.employeeId && sale.employee) {
          const employee = employeeRows.get(sale.employeeId) ?? this.emptyEmployeeSummary(sale.employeeId, sale.employee);
          employee._sum.deliveryPay = employee._sum.deliveryPay.plus(sale.deliveryPay);
          employee.shippingCost = employee.shippingCost.plus(sale.deliveryPay);
          employee.net = employee.cash.minus(employee.shippingCost);
          employee.netCash = employee.net;
          employeeRows.set(sale.employeeId, employee);
        }

        if (sale.sellerId && sale.seller) {
          const seller = sellerRows.get(sale.sellerId) ?? this.emptySellerSummary(sale.sellerId, sale.seller);
          seller._sum.deliveryPay = seller._sum.deliveryPay.plus(sale.deliveryPay);
          seller.shippingCost = seller.shippingCost.plus(sale.deliveryPay);
          seller.amountToPay = seller.totalSold.minus(seller.shippingCost).minus(seller.perfumeCost);
          sellerRows.set(sale.sellerId, seller);
        }
      }

      if (sale.messengerId && sale.messenger) {
        const messenger = messengerRows.get(sale.messengerId) ?? this.emptyMessengerSummary(sale.messengerId, sale.messenger);
        if (sale.status === 'FINALIZED' || sale.status === 'CANCELLED') {
          messenger._sum.amountCash = messenger._sum.amountCash.plus(sale.amountCash);
          messenger._sum.deliveryPay = messenger._sum.deliveryPay.plus(sale.deliveryPay);
          messenger._count.id += 1;
          messenger.finalizedDeliveries += 1;
        }

        if (sale.status === 'DELIVERY_PENDING') {
          messenger.pendingDeliveryPay = messenger.pendingDeliveryPay.plus(sale.deliveryPay);
          messenger.pendingMoney = messenger.pendingMoney.plus(sale.amountCash);
        }

        messengerRows.set(sale.messengerId, messenger);
      }
    }

    return {
      totalSale: totals.totalSale,
      totalCash: totals.totalCash,
      totalTransfer: totals.totalTransfer,
      totalMessengerCost: totals.totalMessengerCost,
      netTotal: totals.totalCash.minus(totals.totalMessengerCost),
      totalPerfumes: totals.totalPerfumes,
      ordersCount: totals.ordersCount,
      detailEmployee: this.canViewCashDetail(actor, 'employees') ? [...employeeRows.values()] : [],
      detailSeller: this.canViewCashDetail(actor, 'sellers') ? [...sellerRows.values()] : [],
      detailMessenger: this.canViewCashDetail(actor, 'messengers')
        ? [...messengerRows.values()].sort((a, b) => a.messenger.name.localeCompare(b.messenger.name))
        : []
    };
  }

  private emptyEmployeeSummary(employeeId: string, employee: { id: string; name: string; email: string }) {
    return {
      employeeId,
      employee,
      _sum: {
        amount: new Prisma.Decimal(0),
        amountCash: new Prisma.Decimal(0),
        amountTransfer: new Prisma.Decimal(0),
        deliveryPay: new Prisma.Decimal(0),
        perfumeCount: 0
      },
      _count: { id: 0 },
      total: new Prisma.Decimal(0),
      totalSold: new Prisma.Decimal(0),
      cash: new Prisma.Decimal(0),
      transfer: new Prisma.Decimal(0),
      finalizedDeliveries: 0,
      quantity: 0,
      shippingCost: new Prisma.Decimal(0),
      internalSale: new Prisma.Decimal(0),
      internalSales: new Prisma.Decimal(0),
      net: new Prisma.Decimal(0),
      netCash: new Prisma.Decimal(0)
    };
  }

  private emptySellerSummary(sellerId: string, seller: { id: string; name: string; email: string }) {
    return {
      sellerId,
      seller,
      _sum: {
        amount: new Prisma.Decimal(0),
        deliveryPay: new Prisma.Decimal(0),
        perfumeCount: 0
      },
      _count: { id: 0 },
      totalSold: new Prisma.Decimal(0),
      shippingCost: new Prisma.Decimal(0),
      finalizedDeliveries: 0,
      quantity: 0,
      perfumeCost: new Prisma.Decimal(0),
      amountToPay: new Prisma.Decimal(0)
    };
  }

  private saleProductSaleTotal(details: Array<{ quantity: number; unitPrice: Prisma.Decimal }>) {
    return details.reduce((total, detail) => {
      return total.plus(detail.unitPrice.mul(detail.quantity));
    }, new Prisma.Decimal(0));
  }

  private emptyMessengerSummary(messengerId: string, messenger: { id: string; name: string; email: string }) {
    return {
      messengerId,
      messenger,
      _sum: {
        amountCash: new Prisma.Decimal(0),
        deliveryPay: new Prisma.Decimal(0)
      },
      _count: { id: 0 },
      finalizedDeliveries: 0,
      pendingDeliveryPay: new Prisma.Decimal(0),
      pendingMoney: new Prisma.Decimal(0)
    };
  }

  async listClosures(actor: AuthenticatedUser, input: PaginatedDateRangeInput) {
    const range = dateRangeOrCurrentDay(input);
    const createdAt = buildCreatedAtFilter(range);
    const where = {
      deletedAt: null,
      ...(createdAt ? { createdAt } : {}),
      ...(this.canReadGlobalCashClosures(actor) ? {} : { createdById: actor.id })
    };

    const [items, total] = await Promise.all([
      this.prisma.cashClosure.findMany({
        where,
        include: {
          creator: this.creatorInclude(),
          _count: { select: { details: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.cashClosure.count({ where })
    ]);

    return this.paginated(items.map((item) => this.presentCashClosure(item)), total, input);
  }

  async closureDetails(actor: AuthenticatedUser, id: string, input: ClosureDetailsInput) {
    const closure = await this.prisma.cashClosure.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(this.canReadGlobalCashClosures(actor) ? {} : { createdById: actor.id })
      },
      include: {
        creator: this.creatorInclude()
      }
    });

    if (!closure) throw new NotFoundError('Cierre no encontrado');

    const [details, summaryDetails, totalDetails] = await Promise.all([
      this.prisma.cashClosureDetail.findMany({
        where: { closureId: id },
        include: {
          sale: {
            include: {
              employee: { select: { id: true, name: true } },
              messenger: { select: { id: true, name: true } },
              seller: { select: { id: true, name: true } },
              details: { include: { store: true } }
            }
          }
        },
        orderBy: { sale: { createdAt: 'asc' } },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.cashClosureDetail.findMany({
        where: { closureId: id },
        include: {
          sale: {
            include: {
              employee: { select: { id: true, name: true, email: true } },
              messenger: { select: { id: true, name: true, email: true } },
              seller: { select: { id: true, name: true, email: true } },
              details: { select: { quantity: true, purchaseUnitPrice: true, unitPrice: true } }
            }
          }
        }
      }),
      this.prisma.cashClosureDetail.count({ where: { closureId: id } })
    ]);
    const closureSummary = await this.cashSummary(actor, summaryDetails.map((detail) => detail.sale));

    return this.presentCashClosure({
      ...closure,
      detailMessenger: closureSummary.detailMessenger,
      detailSeller: closureSummary.detailSeller,
      detailEmployee: closureSummary.detailEmployee,
      details: details.map((detail) => ({
        ...detail,
        order: this.presentClosureSale(detail.sale)
      })),
      orderDetails: {
        items: details.map((detail) => this.presentClosureSale(detail.sale)),
        pagination: this.pagination(input, totalDetails)
      },
      detailsPagination: this.pagination(input, totalDetails)
    });
  }

  async updateClosureStatus(id: string, status: CashClosureStatus) {
    const closure = await this.prisma.cashClosure.findFirst({ where: { id, deletedAt: null } });
    if (!closure) throw new NotFoundError('Cierre no encontrado');

    return this.prisma.cashClosure.update({
      where: { id },
      data: { status },
      include: { creator: this.creatorInclude() }
    }).then((closure) => this.presentCashClosure(closure));
  }

  async softDeleteClosure(id: string) {
    const closure = await this.prisma.cashClosure.findFirst({ where: { id, deletedAt: null } });
    if (!closure) throw new NotFoundError('Cierre no encontrado');

    await this.prisma.cashClosure.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  private creatorInclude() {
    return {
      select: {
        id: true,
        name: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                id: true,
                key: true,
                name: true
              }
            }
          }
        }
      }
    } as const;
  }

  private presentCashClosure<TClosure extends CashClosureForPresentation>(closure: TClosure) {
    const creatorRoles = closure.creator?.roleAssignments?.map((assignment) => assignment.role) ?? [];

    return {
      ...closure,
      gross: closure.totalSale,
      grossTotal: closure.totalSale,
      cash: closure.totalCash,
      transfer: closure.totalTransfer,
      messengerCost: closure.totalMessengerCost,
      pendingMessengerCost: closure.pendingMessengerPay,
      pendingPayments: closure.pendingMessengerPay,
      pendingPayment: closure.pendingMessengerPay,
      pendingSalesMoney: closure.pendingMoney,
      pendingAmount: closure.pendingMoney,
      internalSales: closure.internalSale,
      generalSales: closure.generalSale,
      productCount: closure.totalPerfumes,
      totalProducts: closure.totalPerfumes,
      createdByName: closure.creator?.name ?? null,
      creatorName: closure.creator?.name ?? null,
      creatorRoles,
      creatorRoleNames: creatorRoles.map((role) => role.name),
      statusLabel: labelFromMap(cashClosureStatusLabels, closure.status)
    };
  }

  private saleCalculationInclude() {
    return {
      employee: { select: { name: true } },
      seller: { select: { id: true } },
      details: { select: { quantity: true, unitPrice: true } }
    } as const;
  }

  private async pendingTotalsForClosure(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    range: { from: Date; to: Date }
  ) {
    const canGlobal = actor.permissions.some((permission) => permission.key === 'reports:cash:global');
    const pendingSales = await tx.sale.findMany({
      where: {
        status: 'DELIVERY_PENDING',
        deletedAt: null,
        createdAt: { gte: range.from, lt: range.to },
        ...(canGlobal ? {} : {
          OR: [
            { employeeId: actor.id },
            { sellerId: actor.id },
            { messengerId: actor.id }
          ]
        })
      },
      select: {
        amount: true,
        amountCash: true,
        deliveryPay: true
      }
    });

    return pendingSales.reduce((totals, sale) => {
      totals.pendingMoney = totals.pendingMoney.plus(sale.amount);
      totals.pendingMessengerPay = totals.pendingMessengerPay.plus(sale.deliveryPay);
      return totals;
    }, {
      pendingMoney: new Prisma.Decimal(0),
      pendingMessengerPay: new Prisma.Decimal(0)
    });
  }

  private presentClosureSale(sale: {
    id: string;
    status: SaleStatus;
    createdAt: Date;
    employee: { id: string; name: string };
    seller: { id: string; name: string } | null;
    messenger: { id: string; name: string } | null;
    perfumeCount: number;
    deliveryPay: Prisma.Decimal;
    amount: Prisma.Decimal;
    paymentMethod: string;
  }) {
    return {
      id: sale.id,
      status: sale.status,
      statusLabel: labelFromMap(saleStatusLabels, sale.status),
      createdAt: sale.createdAt,
      employee: sale.employee,
      seller: sale.seller,
      messenger: sale.messenger,
      productCount: sale.perfumeCount,
      totalPerfumes: sale.perfumeCount,
      messengerCost: sale.deliveryPay,
      total: sale.amount,
      paymentMethod: sale.paymentMethod,
      paymentMethodLabel: labelFromMap(paymentMethodLabels, sale.paymentMethod)
    };
  }

  private closableStatuses(): SaleStatus[] {
    return ['FINALIZED', 'CANCELLED'];
  }

  private canViewCashDetail(actor: AuthenticatedUser, detail: 'messengers' | 'sellers' | 'employees') {
    if (detail === 'messengers' && this.hasAnyRole(actor, ['admin', 'employee', 'seller', 'messenger'])) {
      return true;
    }

    if ((detail === 'sellers' || detail === 'employees') && !this.hasAnyRole(actor, ['admin'])) {
      return false;
    }

    const action = `cash-detail-${detail}`;
    return actor.permissions.some((permission) => {
      return permission.resource === 'reports'
        && permission.action === action
        && (permission.scope === 'global' || permission.scope === 'own');
    });
  }

  private hasAnyRole(actor: AuthenticatedUser, roles: string[]) {
    return actor.roles.some((role) => roles.includes(role.roleKey));
  }

  private canReadGlobalCashClosures(actor: AuthenticatedUser) {
    return actor.permissions.some((permission) => permission.key === 'cash-closures:read:global');
  }

  private closableSalesWhere(actor: AuthenticatedUser, input: CreateCashClosureInput): Prisma.SaleWhereInput {
    const range = dateRangeOrCurrentDay(input);
    const createdAt = buildCreatedAtFilter(range);
    const canGlobal = actor.permissions.some((permission) => permission.key === 'reports:cash:global');

    return {
      status: { in: this.closableStatuses() },
      deletedAt: null,
      ...(createdAt ? { createdAt } : {}),
      ...(canGlobal ? {} : {
        OR: [
          { employeeId: actor.id },
          { sellerId: actor.id },
          { messengerId: actor.id }
        ]
      })
    };
  }

  private reconciliationSalesWhere(actor: AuthenticatedUser, input: CreateCashClosureInput): Prisma.SaleWhereInput {
    return {
      ...this.closableSalesWhere(actor, input),
      status: { in: ['FINALIZED', 'CANCELLED', 'DELIVERY_PENDING'] }
    };
  }

  private closableSalesByIdsWhere(
    actor: AuthenticatedUser,
    saleIds: string[]
  ): Prisma.SaleWhereInput {
    const canGlobal = actor.permissions.some((permission) => permission.key === 'reports:cash:global');

    return {
      id: { in: saleIds },
      status: { in: this.closableStatuses() },
      deletedAt: null,
      ...(canGlobal ? {} : {
        OR: [
          { employeeId: actor.id },
          { sellerId: actor.id },
          { messengerId: actor.id }
        ]
      })
    };
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
