import { describe, expect, it } from 'vitest';
import { createExpenseControlSchema, updateExpenseControlSchema } from './expenseSchemas.js';

describe('expense schemas', () => {
  it('acepta creación con una sola referencia de categoría', () => {
    expect(createExpenseControlSchema.parse({ amount: '100.50', type: 'EXPENSE', categoryName: 'Publicidad', date: '2026-09-17' })).toMatchObject({ amount: 100.5 });
  });

  it('acepta actualizaciones parciales y rechaza payload vacío', () => {
    expect(updateExpenseControlSchema.parse({ amount: '200' })).toEqual({ amount: 200 });
    expect(() => updateExpenseControlSchema.parse({})).toThrow();
  });

  it('rechaza dos referencias de categoría simultáneas', () => {
    expect(() => createExpenseControlSchema.parse({ amount: 10, type: 'INCOME', categoryId: 'cf6a89cc-e4d2-4246-bf49-ef0cd79e3d6f', categoryName: 'Ventas', date: '2026-09-17' })).toThrow();
  });
});
