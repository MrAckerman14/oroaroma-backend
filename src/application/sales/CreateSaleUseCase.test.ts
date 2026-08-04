import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import { CreateSaleUseCase } from './CreateSaleUseCase.js';

const product = {
  id: 'product-1',
  name: 'Perfume 175',
  description: 'Producto de prueba',
  purchasePrice: new Prisma.Decimal('100'),
  salePrice: new Prisma.Decimal('175'),
  stock: 10,
  imagePath: '/uploads/products/perfume.png',
  deletedAt: null
};

function makeUseCase(overrides: { stock?: number; updateCount?: number } = {}) {
  const saleCreate = vi.fn(async ({ data }: { data: Record<string, any> }) => ({
    id: 'sale-1',
    ...data,
    details: data.details.create.map((detail: Record<string, any>, index: number) => ({
      id: `detail-${index + 1}`,
      storeId: detail.storeId,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      store: {
        id: detail.storeId,
        name: product.name,
        description: product.description,
        imagePath: product.imagePath
      }
    }))
  }));
  const tx = {
    store: {
      findMany: vi.fn().mockResolvedValue([{ ...product, stock: overrides.stock ?? product.stock }]),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.updateCount ?? 1 })
    },
    sale: {
      create: saleCreate
    }
  };
  const prisma = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx))
  };

  return {
    useCase: new CreateSaleUseCase(prisma as unknown as PrismaClient),
    tx,
    saleCreate
  };
}

describe('CreateSaleUseCase', () => {
  it('crea la venta con precio de venta, conserva precio de compra interno y descuenta stock', async () => {
    const { useCase, tx, saleCreate } = makeUseCase();

    const sale = await useCase.execute('employee-1', {
      sellerId: 'seller-1',
      messengerId: 'messenger-1',
      amount: '350',
      amountCash: '150',
      amountTransfer: '200',
      deliveryPay: '75',
      phone: '(000)-000-0000',
      description: 'Cliente pidio entrega hoy',
      locationUrl: 'https://maps.example.com/order-1',
      items: [{ productId: product.id, quantity: 2 }]
    });

    expect(saleCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId: 'employee-1',
        sellerId: 'seller-1',
        messengerId: 'messenger-1',
        paymentMethod: 'MIXED',
        perfumeCount: 2,
        description: 'Cliente pidio entrega hoy',
        locationUrl: 'https://maps.example.com/order-1'
      })
    }));
    expect(saleCreate.mock.calls[0]?.[0].data.details.create).toEqual([{
      storeId: product.id,
      quantity: 2,
      unitPrice: product.salePrice,
      purchaseUnitPrice: product.purchasePrice
    }]);
    expect(tx.store.updateMany).toHaveBeenCalledWith({
      where: {
        id: product.id,
        stock: { gte: 2 },
        deletedAt: null
      },
      data: { stock: { decrement: 2 } }
    });
    expect(sale.details[0]).toMatchObject({
      productId: product.id,
      productName: product.name,
      quantity: 2
    });
    expect(sale.details[0]?.subtotal.toString()).toBe('350');
  });

  it('rechaza cuando efectivo y transferencia superan el monto total', async () => {
    const { useCase, saleCreate } = makeUseCase();

    await expect(useCase.execute('employee-1', {
      amount: '100',
      amountCash: '70',
      amountTransfer: '40',
      deliveryPay: '0',
      items: [{ productId: product.id, quantity: 1 }]
    })).rejects.toBeInstanceOf(ValidationAppError);
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it('rechaza si no hay stock suficiente antes de crear la venta', async () => {
    const { useCase, saleCreate } = makeUseCase({ stock: 1 });

    await expect(useCase.execute('employee-1', {
      amount: '350',
      amountCash: '350',
      amountTransfer: '0',
      deliveryPay: '0',
      items: [{ productId: product.id, quantity: 2 }]
    })).rejects.toBeInstanceOf(ValidationAppError);
    expect(saleCreate).not.toHaveBeenCalled();
  });
});
