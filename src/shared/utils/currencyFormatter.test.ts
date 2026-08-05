import { describe, expect, it } from 'vitest';
import { addFormattedCurrencyFields } from './currencyFormatter.js';

describe('addFormattedCurrencyFields', () => {
  it('no formatea pagination.total como dinero', () => {
    const result = addFormattedCurrencyFields({
      data: {
        amount: '1200',
        pagination: {
          page: 1,
          pageSize: 100,
          total: 4,
          totalPages: 1
        }
      }
    });

    expect(result.data).toMatchObject({
      amountFormatted: 'RD$1,200',
      pagination: {
        total: 4
      }
    });
    expect(result.data.pagination).not.toHaveProperty('totalFormatted');
  });
});
