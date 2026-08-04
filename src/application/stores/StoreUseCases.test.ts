import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { StoreUseCases } from './StoreUseCases.js';

const product = {
  id: 'product-1',
  name: 'Perfume privado',
  description: 'Producto de prueba',
  purchasePrice: new Prisma.Decimal('100'),
  salePrice: new Prisma.Decimal('175'),
  stock: 8,
  imagePath: '/uploads/products/test.png',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null
};

function makeUseCases() {
  const prisma = {
    store: {
      findMany: vi.fn().mockResolvedValue([product]),
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue(product)
    },
    saleDetail: {
      groupBy: vi.fn().mockResolvedValue([{
        storeId: product.id,
        _sum: { quantity: 3 }
      }])
    }
  };

  return {
    stores: new StoreUseCases(prisma as unknown as PrismaClient),
    prisma
  };
}

describe('StoreUseCases', () => {
  it('oculta precios sensibles en el listado publico de productos', async () => {
    const { stores } = makeUseCases();

    const result = await stores.list({ page: 1, pageSize: 10 });

    expect(result.items[0]).toEqual({
      id: product.id,
      name: product.name,
      description: product.description,
      stock: product.stock,
      imagePath: product.imagePath,
      quantitySold: 3,
      soldQuantity: 3,
      totalSold: 3,
      soldCount: 3
    });
    expect(result.items[0]).not.toHaveProperty('purchasePrice');
    expect(result.items[0]).not.toHaveProperty('salePrice');
  });

  it('mantiene los precios cuando se solicita la vista sensible', async () => {
    const { stores } = makeUseCases();

    const result = await stores.list({ page: 1, pageSize: 10 }, { includeSensitivePrices: true });

    expect(result.items[0]).toHaveProperty('purchasePrice');
    expect(result.items[0]).toHaveProperty('salePrice');
  });

  it('filtra por stock y suma vendidos finalizados en el rango solicitado', async () => {
    const { stores, prisma } = makeUseCases();

    await stores.list(
      { page: 1, pageSize: 10 },
      { from: '2026-06-01', to: '2026-06-07', minStock: 2, maxStock: 10 }
    );

    expect(prisma.store.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        stock: { gte: 2, lte: 10 }
      })
    }));
    expect(prisma.saleDetail.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['storeId'],
      where: expect.objectContaining({
        storeId: { in: [product.id] },
        sale: expect.objectContaining({
          status: 'FINALIZED',
          deletedAt: null
        })
      }),
      _sum: { quantity: true }
    }));
  });
});
