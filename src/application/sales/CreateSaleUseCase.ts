import { Prisma, type PrismaClient } from '@prisma/client';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { CreateSaleInput } from '../../types/sales.js';
import { presentSale } from './salePresenter.js';

export class CreateSaleUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(employeeId: string, input: CreateSaleInput) {
    const amount = new Prisma.Decimal(input.amount);
    const amountCash = new Prisma.Decimal(input.amountCash);
    const amountTransfer = new Prisma.Decimal(input.amountTransfer);

    if (amountCash.plus(amountTransfer).greaterThan(amount)) {
      throw new ValidationAppError('El efectivo y transferencia superan el monto total');
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = input.items.map((item) => item.productId);
      const products = await tx.store.findMany({
        where: { id: { in: productIds }, deletedAt: null }
      });

      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const item of input.items) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new ValidationAppError(`Producto inexistente: ${item.productId}`);
        }
        if (product.stock < item.quantity) {
          throw new ValidationAppError(`Stock insuficiente para ${product.name}`);
        }
      }

      const perfumeCount = input.items.reduce((total, item) => total + item.quantity, 0);
      const paymentMethod = amountCash.greaterThan(0) && amountTransfer.greaterThan(0)
        ? 'MIXED'
        : amountTransfer.greaterThan(0)
          ? 'TRANSFER'
          : 'CASH';

      const sale = await tx.sale.create({
        data: {
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
          details: {
            create: input.items.map((item) => {
              const product = productsById.get(item.productId);
              if (!product) {
                throw new ValidationAppError('Uno de los productos seleccionados no esta disponible');
              }
              return {
                storeId: item.productId,
                quantity: item.quantity,
                unitPrice: product.salePrice,
                purchaseUnitPrice: product.purchasePrice
              };
            })
          }
        },
        include: {
          details: {
            include: {
              store: true
            }
          }
        }
      });

      for (const item of input.items) {
        const updated = await tx.store.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
            deletedAt: null
          },
          data: { stock: { decrement: item.quantity } }
        });

        if (updated.count !== 1) {
          throw new ValidationAppError('Stock insuficiente durante la confirmacion de venta');
        }
      }

      return presentSale(sale);
    });
  }
}
