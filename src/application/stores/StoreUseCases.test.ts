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

function makeUseCases(products = [product]) {
  const prisma = {
    store: {
      findMany: vi.fn().mockResolvedValue(products),
      count: vi.fn().mockResolvedValue(products.length),
      findFirst: vi.fn().mockResolvedValue(products[0])
    },
    saleDetail: {
      groupBy: vi.fn().mockResolvedValue(products.map((item, index) => ({
        storeId: item.id,
        _sum: { quantity: products.length === 1 ? 3 : index + 1 }
      })))
    }
  };

  return {
    stores: new StoreUseCases(prisma as unknown as PrismaClient),
    prisma
  };
}

describe('StoreUseCases', () => {
  it('muestra precio de venta y oculta precio de compra en el listado no administrativo', async () => {
    const { stores } = makeUseCases();

    const result = await stores.list({ page: 1, pageSize: 10 });

    expect(result.items[0]).toEqual({
      id: product.id,
      name: product.name,
      description: product.description,
      stock: product.stock,
      imagePath: product.imagePath,
      salePrice: product.salePrice,
      quantitySold: 3,
      soldQuantity: 3,
      totalSold: 3,
      soldCount: 3
    });
    expect(result.items[0]).not.toHaveProperty('purchasePrice');
  });

  it('ordena los productos alfabeticamente por defecto', async () => {
    const zProduct = { ...product, id: 'product-z', name: 'Zafiro' };
    const aProduct = { ...product, id: 'product-a', name: 'Ambar' };
    const { stores, prisma } = makeUseCases([zProduct, aProduct]);

    const result = await stores.list({ page: 1, pageSize: 10 });

    expect(prisma.store.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { name: 'asc' }
    }));
    expect(result.items.map((item) => item.name)).toEqual(['Ambar', 'Zafiro']);
  });

  it('no reordena por vendidos cuando calcula cantidades vendidas', async () => {
    const firstProduct = { ...product, id: 'product-first', name: 'A primero' };
    const secondProduct = { ...product, id: 'product-second', name: 'B segundo' };
    const { stores, prisma } = makeUseCases([firstProduct, secondProduct]);
    prisma.saleDetail.groupBy.mockResolvedValue([
      { storeId: firstProduct.id, _sum: { quantity: 1 } },
      { storeId: secondProduct.id, _sum: { quantity: 99 } }
    ]);

    const result = await stores.list({ page: 1, pageSize: 10 });

    expect(result.items).toMatchObject([
      {
        id: firstProduct.id,
        quantitySold: 1
      },
      {
        id: secondProduct.id,
        quantitySold: 99
      }
    ]);
  });

  it('incluye cantidad vendida en el listado no administrativo', async () => {
    const { stores } = makeUseCases();

    const result = await stores.list({ page: 1, pageSize: 10 });

    expect(result.items[0]).toMatchObject({
      quantitySold: 3,
      soldQuantity: 3,
      totalSold: 3,
      soldCount: 3
    });
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
