import { describe, expect, it } from 'vitest';
import { addFormattedCurrencyFields, formatCurrency } from '../src/shared/utils/currencyFormatter.js';

describe('currencyFormatter', () => {
  it('formats Dominican pesos with dot decimals and comma groups', () => {
    expect(formatCurrency('50.07')).toBe('RD$50.07');
    expect(formatCurrency('1000')).toBe('RD$1,000');
    expect(formatCurrency('700000')).toBe('RD$700,000');
  });

  it('keeps cents when present and omits zero cents', () => {
    expect(formatCurrency('50.70')).toBe('RD$50.70');
    expect(formatCurrency('50.00')).toBe('RD$50');
    expect(formatCurrency('0')).toBe('RD$0.00');
    expect(formatCurrency('0.07')).toBe('RD$0.07');
  });

  it('adds formatted fields without replacing raw values', () => {
    const response = addFormattedCurrencyFields({
      data: {
        amount: '50.07',
        earnedMoney: '300',
        messengerEarnings: '300',
        totalEarned: '300',
        pendingCashTotal: '250',
        totalPendingCash: '250',
        pendingCashAmount: '250',
        totalProducts: 700000,
        details: [
          {
            unitPrice: '1000.00',
            quantity: 2
          }
        ]
      }
    });

    expect(response).toEqual({
      data: {
        amount: '50.07',
        amountFormatted: 'RD$50.07',
        earnedMoney: '300',
        earnedMoneyFormatted: 'RD$300',
        messengerEarnings: '300',
        messengerEarningsFormatted: 'RD$300',
        totalEarned: '300',
        totalEarnedFormatted: 'RD$300',
        pendingCashTotal: '250',
        pendingCashTotalFormatted: 'RD$250',
        totalPendingCash: '250',
        totalPendingCashFormatted: 'RD$250',
        pendingCashAmount: '250',
        pendingCashAmountFormatted: 'RD$250',
        totalProducts: 700000,
        details: [
          {
            unitPrice: '1000.00',
            unitPriceFormatted: 'RD$1,000',
            quantity: 2
          }
        ]
      }
    });
  });
});
