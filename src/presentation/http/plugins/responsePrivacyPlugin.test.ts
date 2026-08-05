import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { sanitizeResponse } from './responsePrivacyPlugin.js';

describe('sanitizeResponse', () => {
  it('quita precios internos y correos en respuestas no admin', () => {
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
          email: 'otro@oroaroma.local',
          purchasePrice: '100',
          purchaseUnitPrice: '100',
          salePrice: '175',
          stock: 5
        }]
      }
    }, request) as { data: { items: Array<Record<string, unknown>> } };

    expect(result.data.items[0]).toEqual({
      name: 'Perfume',
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
      email: 'admin@oroaroma.local'
    }, request);

    expect(result).toEqual({
      purchasePrice: '100',
      salePrice: '175',
      email: 'admin@oroaroma.local'
    });
  });
});
