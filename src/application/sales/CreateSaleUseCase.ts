import { Prisma, type PrismaClient } from '@prisma/client';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { CreateSaleInput } from '../../types/sales.js';
import { presentSale } from './salePresenter.js';
import { InventoryStockService } from '../inventory/InventoryStockService.js';

export class CreateSaleUseCase {
  private readonly inventory = new InventoryStockService();

  constructor(private readonly prisma: PrismaClient) {}

  async execute(employeeId: string, tenantIdOrInput: string | CreateSaleInput, branchId?: string, explicitInput?: CreateSaleInput) {
    const legacy = typeof tenantIdOrInput !== 'string';
    const tenantId = legacy ? undefined : tenantIdOrInput;
    const input = legacy ? tenantIdOrInput : explicitInput!;
    const amount = new Prisma.Decimal(input.amount);
    const amountCash = new Prisma.Decimal(input.amountCash);
    const amountTransfer = new Prisma.Decimal(input.amountTransfer);

    if (amountCash.plus(amountTransfer).greaterThan(amount)) {
      throw new ValidationAppError('El efectivo y transferencia superan el monto total');
    }

    return this.prisma.$transaction(async (tx) => {
      if (tenantId && branchId) {
        await this.assertParticipantsBelongToBranch(tx, tenantId, branchId, [
          employeeId,
          input.messengerId,
          input.sellerId
        ]);
      }

      const productIds = input.items.map((item) => item.productId);
      const products = await tx.store.findMany({
        where: {
          id: { in: productIds },
          ...(tenantId ? { tenantId } : {}),
          deletedAt: null,
          ...(tenantId && branchId ? {
            branchExclusions: { none: { tenantId, branchId } }
          } : {})
        }
      });

      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const item of input.items) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new ValidationAppError(`Producto inexistente: ${item.productId}`);
        }
        if (legacy && product.stock < item.quantity) {
          throw new ValidationAppError(`Stock insuficiente para ${product.name}`);
        }
      }

      const poolByProduct = new Map<string, string>();
      for (const item of legacy ? [] : input.items) {
        const product = productsById.get(item.productId)!;
        const poolId = await this.inventory.decrement(tx, {
          tenantId: tenantId!, branchId: branchId!, productId: item.productId, quantity: item.quantity, productName: product.name
        });
        poolByProduct.set(item.productId, poolId);
      }

      const perfumeCount = input.items.reduce((total, item) => total + item.quantity, 0);
      const paymentMethod = amountCash.greaterThan(0) && amountTransfer.greaterThan(0)
        ? 'MIXED'
        : amountTransfer.greaterThan(0)
          ? 'TRANSFER'
          : 'CASH';

      const sale = await tx.sale.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
          ...(branchId ? { branchId } : {}),
          employeeId,
          messengerId: input.messengerId ?? null,
          sellerId: input.sellerId ?? null,
          amount,
          amountCash,
          amountTransfer,
          paymentMethod,
          deliveryPay: new Prisma.Decimal(input.deliveryPay),
          perfumeCount,
          status: 'DELIVERY_PENDING',
          phone: input.phone ?? null,
          description: input.description ?? null,
          locationUrl: input.locationUrl?.trim() || null,
          details: {
            create: input.items.map((item) => {
              const product = productsById.get(item.productId);
              if (!product) {
                throw new ValidationAppError('Uno de los productos seleccionados no esta disponible');
              }
              return {
                ...(tenantId ? { tenantId } : {}),
                storeId: item.productId,
                ...(poolByProduct.has(item.productId) ? { inventoryPoolId: poolByProduct.get(item.productId)! } : {}),
                quantity: item.quantity,
                unitPrice: product.salePrice,
                purchaseUnitPrice: product.purchasePrice
              };
            })
          }
        },
        include: {
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
        }
      });

      if (legacy) {
        for (const item of input.items) {
          const updated = await tx.store.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity }, deletedAt: null },
            data: { stock: { decrement: item.quantity } }
          });
          if (updated.count !== 1) throw new ValidationAppError('Stock insuficiente durante la confirmacion de venta');
        }
      }

      return presentSale(sale);
    });
  }

  private async assertParticipantsBelongToBranch(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string,
    participantIds: Array<string | null | undefined>
  ) {
    const ids = [...new Set(participantIds.filter((id): id is string => Boolean(id)))];
    const users = await tx.user.findMany({
      where: {
        id: { in: ids },
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        branchMemberships: { some: { tenantId, branchId } }
      },
      select: { id: true }
    });

    if (users.length !== ids.length) {
      throw new ValidationAppError('Todo el personal de la venta debe estar activo y asignado a la sucursal');
    }
  }
}
