import { Prisma, type PrismaClient, type SaleStatus } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, dateRangeOrCurrentDay } from '../../shared/utils/dateRange.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { presentSale } from './salePresenter.js';

export interface SaleListQuery {
  from?: string | undefined;
  to?: string | undefined;
  status?: SaleStatus | undefined;
  page: number;
  pageSize: number;
}

export interface UpdateSaleInput {
  employeeId?: string | undefined;
  messengerId?: string | null | undefined;
  sellerId?: string | null | undefined;
  amount?: string | undefined;
  amountCash?: string | undefined;
  amountTransfer?: string | undefined;
  deliveryPay?: string | undefined;
  phone?: string | null | undefined;
  status?: SaleStatus | undefined;
  items?: Array<{ productId: string; quantity: number }> | undefined;
}

export class SaleUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async list(actor: AuthenticatedUser, query: SaleListQuery) {
    const range = dateRangeOrCurrentDay({ from: query.from, to: query.to });
    const createdAt = buildCreatedAtFilter(range);
    const accessWhere = this.buildAccessWhere(actor);

    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...accessWhere
    };

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: this.saleIncludes(),
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.sale.count({ where })
    ]);

    return this.paginated(items.map((sale) => presentSale(sale)), total, query);
  }

  async update(id: string, actor: AuthenticatedUser, input: UpdateSaleInput) {
    const sale = await this.findActive(id);
    const action = input.status === 'FINALIZED'
      ? 'finalize'
      : input.status === 'CANCELLED'
        ? 'cancel'
        : 'update';
    this.assertCanAccessSale(actor, sale, action);

    const updatedSale = await this.prisma.$transaction(async (tx) => {
      if (input.status === 'DELIVERY_PENDING' && sale.status === 'CANCELLED') {
        throw new ValidationAppError('No se puede reabrir una venta cancelada automaticamente');
      }

      if (input.status === 'FINALIZED' && sale.status === 'CANCELLED') {
        throw new ValidationAppError('No se puede finalizar una venta cancelada');
      }

      if (input.status === 'CANCELLED' && sale.closureDetails.length > 0 && sale.status !== 'DELIVERY_PENDING') {
        throw new ValidationAppError('No se puede cancelar una venta incluida en un cierre de caja');
      }

      if (input.items && sale.status === 'CANCELLED') {
        throw new ValidationAppError('No se pueden editar productos de una venta cancelada');
      }

      if (input.items && input.status === 'CANCELLED') {
        throw new ValidationAppError('Edita los productos antes de cancelar la venta');
      }

      if (input.items && sale.closureDetails.length > 0) {
        throw new ValidationAppError('No se pueden editar productos de una venta incluida en un cierre de caja');
      }

      const itemUpdate = input.items
        ? await this.replaceSaleItems(tx, id, input.items)
        : undefined;

      if (input.status === 'CANCELLED' && sale.status !== 'CANCELLED') {
        const details = await tx.saleDetail.findMany({ where: { saleId: id } });
        for (const detail of details) {
          await tx.store.update({
            where: { id: detail.storeId },
            data: { stock: { increment: detail.quantity } }
          });
        }
      }

      const amount = input.amount ? new Prisma.Decimal(input.amount) : sale.amount;
      const amountCash = input.amountCash ? new Prisma.Decimal(input.amountCash) : sale.amountCash;
      const amountTransfer = input.amountTransfer ? new Prisma.Decimal(input.amountTransfer) : sale.amountTransfer;

      if (amountCash.plus(amountTransfer).greaterThan(amount)) {
        throw new ValidationAppError('El efectivo y transferencia superan el monto total');
      }

      const paymentMethod = amountCash.greaterThan(0) && amountTransfer.greaterThan(0)
        ? 'MIXED'
        : amountTransfer.greaterThan(0)
          ? 'TRANSFER'
          : 'CASH';

      return tx.sale.update({
        where: { id },
        data: {
          ...(input.messengerId !== undefined ? { messengerId: input.messengerId } : {}),
          ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
          ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
          ...(input.amount ? { amount } : {}),
          ...(input.amountCash ? { amountCash } : {}),
          ...(input.amountTransfer ? { amountTransfer } : {}),
          ...(
            input.amount || input.amountCash || input.amountTransfer
              ? { paymentMethod }
              : {}
          ),
          ...(input.deliveryPay ? { deliveryPay: new Prisma.Decimal(input.deliveryPay) } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(itemUpdate ? { perfumeCount: itemUpdate.perfumeCount } : {}),
          ...(input.status ? {
            status: input.status,
            finalizedAt: input.status === 'FINALIZED' ? new Date() : sale.finalizedAt,
            cancelledAt: input.status === 'CANCELLED' ? new Date() : sale.cancelledAt
          } : {})
        },
        include: this.saleIncludes()
      });
    });

    return presentSale(updatedSale);
  }

  async softDelete(id: string, actor: AuthenticatedUser) {
    const sale = await this.findActive(id);
    this.assertCanAccessSale(actor, sale, 'delete');

    if (sale.closureDetails.length > 0) {
      throw new ValidationAppError('No se puede eliminar una venta incluida en un cierre de caja');
    }

    await this.prisma.$transaction(async (tx) => {
      if (sale.status !== 'CANCELLED') {
        for (const detail of sale.details) {
          await tx.store.update({
            where: { id: detail.storeId },
            data: { stock: { increment: detail.quantity } }
          });
        }
      }

      await tx.sale.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
    });
  }

  private async findActive(id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, deletedAt: null },
      include: { details: true, closureDetails: true }
    });
    if (!sale) throw new NotFoundError('Venta no encontrada');
    return sale;
  }

  private buildAccessWhere(actor: AuthenticatedUser) {
    const canReadGlobal = actor.permissions.some((permission) => {
      return permission.key === 'sales:read:global';
    });

    if (canReadGlobal) return {};

    return {
      OR: [
        { employeeId: actor.id },
        { sellerId: actor.id },
        { messengerId: actor.id }
      ]
    };
  }

  private assertCanAccessSale(
    actor: AuthenticatedUser,
    sale: { employeeId: string; sellerId: string | null; messengerId: string | null },
    action: 'update' | 'delete' | 'finalize' | 'cancel'
  ) {
    const canGlobal = actor.permissions.some((permission) => {
      return permission.key === `sales:${action}:global`;
    });

    if (canGlobal) return;

    const canOwn = actor.permissions.some((permission) => {
      return permission.key === `sales:${action}:own`;
    });

    if (canOwn && [sale.employeeId, sale.sellerId, sale.messengerId].includes(actor.id)) return;

    throw new ForbiddenError('No tienes acceso a esta venta');
  }

  private saleIncludes() {
    return {
      employee: { select: { id: true, name: true } },
      messenger: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      details: {
        include: {
          store: true
        }
      }
    } as const;
  }

  private async replaceSaleItems(
    tx: Prisma.TransactionClient,
    saleId: string,
    items: Array<{ productId: string; quantity: number }>
  ) {
    const mergedItems = this.mergeItems(items);
    const productIds = mergedItems.map((item) => item.productId);
    const [currentDetails, products] = await Promise.all([
      tx.saleDetail.findMany({ where: { saleId } }),
      tx.store.findMany({
        where: {
          id: { in: productIds },
          deletedAt: null
        }
      })
    ]);

    const productsById = new Map(products.map((product) => [product.id, product]));
    const currentQuantityByProduct = new Map<string, number>();

    for (const detail of currentDetails) {
      currentQuantityByProduct.set(
        detail.storeId,
        (currentQuantityByProduct.get(detail.storeId) ?? 0) + detail.quantity
      );
    }

    for (const item of mergedItems) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new ValidationAppError(`Producto inexistente: ${item.productId}`);
      }

      const currentQuantity = currentQuantityByProduct.get(item.productId) ?? 0;
      const delta = item.quantity - currentQuantity;
      if (delta > 0) {
        const updated = await tx.store.updateMany({
          where: {
            id: item.productId,
            stock: { gte: delta },
            deletedAt: null
          },
          data: { stock: { decrement: delta } }
        });

        if (updated.count !== 1) {
          throw new ValidationAppError(`Stock insuficiente para ${product.name}`);
        }
      }

      if (delta < 0) {
        await tx.store.update({
          where: { id: item.productId },
          data: { stock: { increment: Math.abs(delta) } }
        });
      }
    }

    for (const [productId, currentQuantity] of currentQuantityByProduct.entries()) {
      if (productIds.includes(productId)) continue;
      await tx.store.update({
        where: { id: productId },
        data: { stock: { increment: currentQuantity } }
      });
    }

    await tx.saleDetail.deleteMany({ where: { saleId } });
    await tx.saleDetail.createMany({
      data: mergedItems.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new ValidationAppError('Uno de los productos seleccionados no esta disponible');
        }

        return {
          saleId,
          storeId: item.productId,
          quantity: item.quantity,
          unitPrice: product.salePrice,
          purchaseUnitPrice: product.purchasePrice
        };
      })
    });

    return {
      perfumeCount: mergedItems.reduce((total, item) => total + item.quantity, 0)
    };
  }

  private mergeItems(items: Array<{ productId: string; quantity: number }>) {
    const quantityByProduct = new Map<string, number>();
    for (const item of items) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    return [...quantityByProduct.entries()].map(([productId, quantity]) => ({
      productId,
      quantity
    }));
  }

  private paginated<T>(items: T[], total: number, pagination: { page: number; pageSize: number }) {
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize)
      }
    };
  }
}
