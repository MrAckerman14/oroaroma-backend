import { describe, expect, it } from 'vitest';
import { createSaleSchema, updateSaleSchema } from './saleSchemas.js';

describe('saleSchemas', () => {
  const productId = '11111111-1111-4111-8111-111111111111';

  it('acepta ubicaciones en texto al crear ventas', () => {
    const input = createSaleSchema.parse({
      amount: '1000',
      amountCash: '1000',
      amountTransfer: '0',
      deliveryPay: '150',
      locationUrl: 'la vega',
      items: [{ productId, quantity: 1 }]
    });

    expect(input.locationUrl).toBe('la vega');
  });

  it('convierte ubicaciones vacias a null al editar ventas', () => {
    const input = updateSaleSchema.parse({
      locationUrl: '   '
    });

    expect(input.locationUrl).toBeNull();
  });
});
