import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { SaleUseCases } from './SaleUseCases.js';

describe('SaleUseCases state transitions', () => {
  const assertTransition = (current: 'DELIVERY_PENDING' | 'FINALIZED' | 'CANCELLED', next: 'DELIVERY_PENDING' | 'FINALIZED' | 'CANCELLED', hasClosure = false) => {
    const sales = new SaleUseCases({} as PrismaClient);
    return () => (sales as unknown as {
      assertStatusTransition: (currentStatus: typeof current, nextStatus: typeof next, closed: boolean) => void;
    }).assertStatusTransition(current, next, hasClosure);
  };

  it('impide reabrir una venta finalizada', () => {
    expect(assertTransition('FINALIZED', 'DELIVERY_PENDING')).toThrow('Una venta finalizada no puede volver');
  });

  it('impide cambiar una venta incluida en un cierre', () => {
    expect(assertTransition('DELIVERY_PENDING', 'CANCELLED', true)).toThrow('incluida en un cierre');
  });
});
