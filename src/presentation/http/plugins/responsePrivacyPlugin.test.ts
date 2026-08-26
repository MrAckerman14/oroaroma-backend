import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { sanitizeResponse } from './responsePrivacyPlugin.js';

describe('sanitizeResponse', () => {
  it('quita costos internos y correos en respuestas no admin, pero mantiene precio de venta', () => {
    const request = {
      url: '/stores',
      authUser: {
        roles: [{ roleKey: 'seller' }]
      }
    } as unknown as FastifyRequest;

    const result = sanitizeResponse({
      data: {
        items: [{
          name: 'Perfume',
          email: 'otro@zoko-hola.local',
          purchasePrice: '100',
          purchaseUnitPrice: '100',
          purchase_price: '100',
          purchase_unit_price: '100',
          salePrice: '175',
          stock: 5
        }]
      }
    }, request) as { data: { items: Array<Record<string, unknown>> } };

    expect(result.data.items[0]).toEqual({
      name: 'Perfume',
      salePrice: '175',
      stock: 5
    });
  });

  it('mantiene la respuesta intacta para admin', () => {
    const request = {
      url: '/stores',
      authUser: {
        roles: [{ roleKey: 'admin' }]
      }
    } as unknown as FastifyRequest;

    const result = sanitizeResponse({
      purchasePrice: '100',
      salePrice: '175',
      email: 'admin@zoko-hola.local'
    }, request);

    expect(result).toEqual({
      purchasePrice: '100',
      salePrice: '175',
      email: 'admin@zoko-hola.local'
    });
  });
});
