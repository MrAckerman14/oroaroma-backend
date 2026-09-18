import { describe, expect, it } from 'vitest';
import { createExpenseControlSchema, updateExpenseControlSchema } from './expenseSchemas.js';

describe('expense schemas', () => {
  it('loads and accepts valid create and partial update payloads', () => {
    expect(createExpenseControlSchema.safeParse({
      amount: 100,
      type: 'EXPENSE',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-09-18'
    }).success).toBe(true);
    expect(updateExpenseControlSchema.safeParse({ amount: 125 }).success).toBe(true);
  });

  it('rejects empty updates and conflicting category selectors', () => {
    expect(updateExpenseControlSchema.safeParse({}).success).toBe(false);
    expect(updateExpenseControlSchema.safeParse({
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      categoryName: 'Publicidad'
    }).success).toBe(false);
  });
});
