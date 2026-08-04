import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { presentSale } from './salePresenter.js';

describe('presentSale', () => {
  it('no expone precio de compra ni objetos crudos del producto', () => {
    const sale = {
      id: 'sale-1',
      status: 'FINALIZED',
      paymentMethod: 'CASH',
      details: [{
        id: 'detail-1',
        saleId: 'sale-1',
        storeId: 'product-1',
        quantity: 2,
        unitPrice: new Prisma.Decimal('175'),
        purchaseUnitPrice: new Prisma.Decimal('100'),
        store: {
          id: 'product-1',
          name: 'Perfume privado',
          description: 'Producto de prueba',
          imagePath: '/uploads/products/test.png',
          purchasePrice: new Prisma.Decimal('100'),
          salePrice: new Prisma.Decimal('175')
        }
      }]
    };

    const result = presentSale(sale);
    const [detail] = result.details;

    expect(detail).toMatchObject({
      id: 'detail-1',
      storeId: 'product-1',
      productId: 'product-1',
      productName: 'Perfume privado',
      quantity: 2
    });
    expect(detail).not.toHaveProperty('purchaseUnitPrice');
    expect(detail).not.toHaveProperty('store');
    expect(JSON.stringify(detail)).not.toContain('purchasePrice');
  });
});
