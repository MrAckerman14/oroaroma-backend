import { Prisma, type PrismaClient, type SaleStatus } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, dateRangeOrCurrentDay } from '../../shared/utils/dateRange.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { presentSale } from './salePresenter.js';
import { InventoryStockService } from '../inventory/InventoryStockService.js';

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
  description?: string | null | undefined;
  locationUrl?: string | null | undefined;
  status?: SaleStatus | undefined;
  items?: Array<{ productId: string; quantity: number }> | undefined;
}

export class SaleUseCases {
  private readonly inventory = new InventoryStockService();

  constructor(private readonly prisma: PrismaClient) {}

  async list(actor: AuthenticatedUser, branchId: string, query: SaleListQuery) {
    const range = dateRangeOrCurrentDay({ from: query.from, to: query.to });
    const createdAt = buildCreatedAtFilter(range);
    const accessWhere = this.buildAccessWhere(actor);

    const where = {
      tenantId: actor.tenantId,
      branchId,
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

  async update(id: string, actor: AuthenticatedUser, branchId: string, input: UpdateSaleInput) {
    const sale = await this.findActive(id, actor.tenantId, branchId);
    const action = input.status === 'FINALIZED'
      ? 'finalize'
      : input.status === 'CANCELLED'
        ? 'cancel'
        : 'update';
    this.assertCanAccessSale(actor, sale, action);

    const updatedSale = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0)) IS NULL AS locked`;
      const currentSale = await tx.sale.findFirst({
        where: { id, tenantId: actor.tenantId, branchId, deletedAt: null },
        include: { details: true, closureDetails: true }
      });
      if (!currentSale) throw new NotFoundError('Venta no encontrada');

      const canReopenCancelled = actor.permissions.some((permission) => permission.key === 'sales:update:global');
      const isReopeningCancelled = currentSale.status === 'CANCELLED'
        && input.status !== undefined
        && input.status !== 'CANCELLED';

      this.assertStatusTransition(currentSale.status, input.status, currentSale.closureDetails.length > 0);
      this.assertParticipantReassignmentAllowed(actor, currentSale, input);
      await this.assertUpdatedParticipants(tx, currentSale, input);

      if (isReopeningCancelled && !canReopenCancelled) {
        throw new ValidationAppError('Se requiere permiso global para reabrir una venta cancelada');
      }

      if (input.status === 'CANCELLED' && currentSale.closureDetails.length > 0 && currentSale.status !== 'DELIVERY_PENDING') {
        throw new ValidationAppError('No se puede cancelar una venta incluida en un cierre de caja');
      }

      const itemChangesRequested = input.items ? this.saleItemsChanged(currentSale.details, input.items) : false;

      if (itemChangesRequested && currentSale.status === 'CANCELLED') {
        throw new ValidationAppError('No se pueden editar productos de una venta cancelada');
      }

      if (itemChangesRequested && input.status === 'CANCELLED') {
        throw new ValidationAppError('Edita los productos antes de cancelar la venta');
      }

      if (itemChangesRequested && currentSale.closureDetails.length > 0) {
        throw new ValidationAppError('No se pueden editar productos de una venta incluida en un cierre de caja');
      }

      const itemUpdate = input.items && itemChangesRequested
        ? await this.replaceSaleItems(tx, { ...currentSale, branchId: currentSale.branchId! }, input.items)
        : undefined;

      if (input.status === 'CANCELLED' && currentSale.status !== 'CANCELLED') {
        const details = await tx.saleDetail.findMany({ where: { saleId: id } });
        for (const detail of details) {
          await this.inventory.increment(tx, {
            tenantId: currentSale.tenantId,
            poolId: detail.inventoryPoolId!,
            productId: detail.storeId,
            quantity: detail.quantity
          });
        }
      }

      if (isReopeningCancelled) {
        const details = await tx.saleDetail.findMany({
          where: { saleId: id },
          include: { store: { select: { name: true } } }
        });

        for (const detail of details) {
          await this.inventory.decrementFromPool(tx, {
            tenantId: currentSale.tenantId,
            poolId: detail.inventoryPoolId!,
            productId: detail.storeId,
            quantity: detail.quantity,
            productName: detail.store.name
          });
        }
      }

      const amount = input.amount ? new Prisma.Decimal(input.amount) : currentSale.amount;
      const amountCash = input.amountCash ? new Prisma.Decimal(input.amountCash) : currentSale.amountCash;
      const amountTransfer = input.amountTransfer ? new Prisma.Decimal(input.amountTransfer) : currentSale.amountTransfer;

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
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.locationUrl !== undefined ? { locationUrl: input.locationUrl?.trim() || null } : {}),
          ...(itemUpdate ? { perfumeCount: itemUpdate.perfumeCount } : {}),
          ...(input.status ? {
            status: input.status,
            finalizedAt: input.status === 'FINALIZED' ? new Date() : currentSale.finalizedAt,
            cancelledAt: input.status === 'CANCELLED'
              ? new Date()
              : isReopeningCancelled
                ? null
                : currentSale.cancelledAt
          } : {})
        },
        include: this.saleIncludes()
      });
    });

    return presentSale(updatedSale);
  }

  async softDelete(id: string, actor: AuthenticatedUser, branchId: string) {
    const sale = await this.findActive(id, actor.tenantId, branchId);
    this.assertCanAccessSale(actor, sale, 'delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0)) IS NULL AS locked`;
      const currentSale = await tx.sale.findFirst({
        where: { id, tenantId: actor.tenantId, branchId, deletedAt: null },
        include: { details: true, closureDetails: true }
      });
      if (!currentSale) throw new NotFoundError('Venta no encontrada');
      if (currentSale.closureDetails.length) {
        throw new ValidationAppError('No se puede eliminar una venta incluida en un cierre de caja');
      }

      if (currentSale.status !== 'CANCELLED') {
        for (const detail of currentSale.details) {
          await this.inventory.increment(tx, {
            tenantId: currentSale.tenantId,
            poolId: detail.inventoryPoolId!,
            productId: detail.storeId,
            quantity: detail.quantity
          });
        }
      }

      await tx.sale.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
    });
  }

  private assertStatusTransition(current: SaleStatus, next: SaleStatus | undefined, hasClosure: boolean) {
    if (!next || next === current) return;
    if (hasClosure) {
      throw new ValidationAppError('No se puede cambiar el estado de una venta incluida en un cierre de caja');
    }
    if (current === 'FINALIZED') {
      throw new ValidationAppError('Una venta finalizada no puede volver a un estado operativo');
    }
  }

  private async assertUpdatedParticipants(
    tx: Prisma.TransactionClient,
    sale: { tenantId: string; branchId: string | null; employeeId: string; messengerId: string | null; sellerId: string | null },
    input: UpdateSaleInput
  ) {
    if (!sale.branchId) throw new ValidationAppError('La venta no tiene una sucursal asignada');
    const ids = [...new Set([
      input.employeeId !== undefined && input.employeeId !== sale.employeeId ? input.employeeId : null,
      input.messengerId !== undefined && input.messengerId !== sale.messengerId ? input.messengerId : null,
      input.sellerId !== undefined && input.sellerId !== sale.sellerId ? input.sellerId : null
    ].filter((id): id is string => Boolean(id)))];
    if (!ids.length) return;
    const users = await tx.user.findMany({
      where: {
        id: { in: ids },
        tenantId: sale.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        branchMemberships: { some: { tenantId: sale.tenantId, branchId: sale.branchId } }
      },
      select: { id: true }
    });
    if (users.length !== ids.length) {
      throw new ValidationAppError('Todo el personal de la venta debe estar activo y asignado a la sucursal');
    }
  }

  private assertParticipantReassignmentAllowed(
    actor: AuthenticatedUser,
    sale: { employeeId: string; messengerId: string | null; sellerId: string | null },
    input: UpdateSaleInput
  ) {
    const changesParticipant = (
      (input.employeeId !== undefined && input.employeeId !== sale.employeeId)
      || (input.messengerId !== undefined && input.messengerId !== sale.messengerId)
      || (input.sellerId !== undefined && input.sellerId !== sale.sellerId)
    );
    if (!changesParticipant) return;
    const canUpdateGlobally = actor.permissions.some((permission) => permission.key === 'sales:update:global');
    if (!canUpdateGlobally) {
      throw new ForbiddenError('Se requiere permiso global para reasignar el personal de una venta');
    }
  }

  private async findActive(id: string, tenantId: string, branchId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId, branchId, deletedAt: null },
      include: { details: true, closureDetails: true }
    });
    if (!sale) throw new NotFoundError('Venta no encontrada');
    return sale;
  }

  private buildAccessWhere(actor: AuthenticatedUser) {
    const canReadBranch = actor.permissions.some((permission) => {
      return permission.key === 'sales:read:global' || permission.key === 'sales:read:store';
    });

    if (canReadBranch) return {};

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
        select: {
          id: true,
          storeId: true,
          quantity: true,
          unitPrice: true,
          store: {
            select: {
              id: true,
              name: true,
              description: true,
              imagePath: true
            }
          }
        }
      }
    } as const;
  }

  private async replaceSaleItems(
    tx: Prisma.TransactionClient,
    sale: { id: string; tenantId: string; branchId: string },
    items: Array<{ productId: string; quantity: number }>
  ) {
    const mergedItems = this.mergeItems(items);
    const productIds = mergedItems.map((item) => item.productId);
    const [currentDetails, products] = await Promise.all([
      tx.saleDetail.findMany({ where: { saleId: sale.id } }),
      tx.store.findMany({
        where: {
          id: { in: productIds },
          tenantId: sale.tenantId,
          deletedAt: null,
          branchExclusions: { none: { tenantId: sale.tenantId, branchId: sale.branchId } }
        }
      })
    ]);

    const productsById = new Map(products.map((product) => [product.id, product]));
    const currentQuantityByProduct = new Map<string, number>();
    const currentPoolByProduct = new Map<string, string>();

    for (const detail of currentDetails) {
      currentQuantityByProduct.set(
        detail.storeId,
        (currentQuantityByProduct.get(detail.storeId) ?? 0) + detail.quantity
      );
      currentPoolByProduct.set(detail.storeId, detail.inventoryPoolId!);
    }

    for (const item of mergedItems) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new ValidationAppError(`Producto inexistente: ${item.productId}`);
      }

      const currentQuantity = currentQuantityByProduct.get(item.productId) ?? 0;
      const delta = item.quantity - currentQuantity;
      if (delta > 0) {
        const poolId = currentPoolByProduct.get(item.productId)
          ?? await this.inventory.resolvePoolId(tx, sale.tenantId, sale.branchId, item.productId);
        await this.inventory.decrementFromPool(tx, {
          tenantId: sale.tenantId, poolId, productId: item.productId, quantity: delta, productName: product.name
        });
        currentPoolByProduct.set(item.productId, poolId);
      }

      if (delta < 0) {
        await this.inventory.increment(tx, {
          tenantId: sale.tenantId,
          poolId: currentPoolByProduct.get(item.productId)!,
          productId: item.productId,
          quantity: Math.abs(delta)
        });
      }
    }

    for (const [productId, currentQuantity] of currentQuantityByProduct.entries()) {
      if (productIds.includes(productId)) continue;
      await this.inventory.increment(tx, {
        tenantId: sale.tenantId,
        poolId: currentPoolByProduct.get(productId)!,
        productId,
        quantity: currentQuantity
      });
    }

    await tx.saleDetail.deleteMany({ where: { saleId: sale.id } });
    await tx.saleDetail.createMany({
      data: mergedItems.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new ValidationAppError('Uno de los productos seleccionados no esta disponible');
        }

        return {
          tenantId: sale.tenantId,
          saleId: sale.id,
          storeId: item.productId,
          inventoryPoolId: currentPoolByProduct.get(item.productId)!,
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

  private saleItemsChanged(
    currentDetails: Array<{ storeId: string; quantity: number }>,
    inputItems: Array<{ productId: string; quantity: number }>
  ) {
    const current = new Map<string, number>();
    for (const detail of currentDetails) {
      current.set(detail.storeId, (current.get(detail.storeId) ?? 0) + detail.quantity);
    }

    const incoming = new Map<string, number>();
    for (const item of this.mergeItems(inputItems)) {
      incoming.set(item.productId, item.quantity);
    }

    if (current.size !== incoming.size) return true;

    for (const [productId, quantity] of current.entries()) {
      if (incoming.get(productId) !== quantity) return true;
    }

    return false;
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
