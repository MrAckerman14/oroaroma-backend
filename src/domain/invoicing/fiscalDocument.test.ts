import { describe, expect, it } from 'vitest';
import {
  assertInvoiceRules,
  buildLines,
  computeTotals,
  creditNoteLines,
  dominicanDate,
  formatEncf,
  isValidEncf,
  isValidTaxId,
  paymentFormsFor,
  resolveInvoiceType
} from './fiscalDocument.js';

describe('e-NCF', () => {
  it('arma el número con tipo y 10 dígitos', () => {
    expect(formatEncf('E32', 1)).toBe('E320000000001');
    expect(formatEncf('E31', 9_999_999_999)).toBe('E319999999999');
    expect(isValidEncf('E310000000123')).toBe(true);
    expect(isValidEncf('B0100000001')).toBe(false);
  });

  it('rechaza números fuera de rango', () => {
    expect(() => formatEncf('E32', 0)).toThrow();
    expect(() => formatEncf('E32', 10_000_000_000)).toThrow();
  });
});

describe('cliente', () => {
  it('acepta RNC de 9 y cédula de 11 dígitos con guiones', () => {
    expect(isValidTaxId('1-31-12345-6')).toBe(true);
    expect(isValidTaxId('001-1234567-8')).toBe(true);
    expect(isValidTaxId('1234')).toBe(false);
  });

  it('elige crédito fiscal cuando hay RNC y consumo cuando no', () => {
    expect(resolveInvoiceType({ rnc: '131123456', name: 'Empresa' })).toBe('E31');
    expect(resolveInvoiceType(null)).toBe('E32');
    expect(resolveInvoiceType({ rnc: '131123456' }, 'E32')).toBe('E32');
  });
});

describe('líneas y totales', () => {
  const items = [
    { name: 'Perfume A', quantity: 2, unitPrice: 1500 },
    { name: 'Perfume B', quantity: 1, unitPrice: 999.99 }
  ];

  it('respeta el total cobrado cuando coincide con los precios', () => {
    const lines = buildLines(items, 3999.99, 18);
    expect(lines.map((line) => line.amount)).toEqual([3000, 999.99]);
    expect(lines.every((line) => line.billingIndicator === 1)).toBe(true);
  });

  it('reparte un descuento sin perder centavos', () => {
    const lines = buildLines(items, 3500, 18);
    const total = lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
    expect(total).toBe(350_000);
    for (const line of lines) {
      expect(Math.round((line.quantity * line.unitPrice - line.discount) * 100)).toBe(Math.round(line.amount * 100));
    }
  });

  it('agrega una línea de servicio cuando se cobró de más (envío)', () => {
    const lines = buildLines(items, 4199.99, 18);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatchObject({ name: 'Envío y otros cargos', amount: 200, kind: 2 });
  });

  it('extrae el ITBIS incluido en el precio', () => {
    const totals = computeTotals(buildLines([{ name: 'X', quantity: 1, unitPrice: 1180 }], 1180, 18), 18, true);
    expect(totals).toEqual({ itbisRate: 18, taxedAmount: 1000, exemptAmount: 0, itbisAmount: 180, totalAmount: 1180 });
  });

  it('suma el ITBIS cuando el precio no lo incluye', () => {
    const totals = computeTotals(buildLines([{ name: 'X', quantity: 1, unitPrice: 1000 }], 1000, 18), 18, false);
    expect(totals.totalAmount).toBe(1180);
    expect(totals.itbisAmount).toBe(180);
  });

  it('cuadra base + ITBIS = total con montos que no dividen exacto', () => {
    const totals = computeTotals(buildLines([{ name: 'X', quantity: 3, unitPrice: 333.33 }], 999.99, 18), 18, true);
    expect(Math.round((totals.taxedAmount + totals.itbisAmount) * 100)).toBe(Math.round(totals.totalAmount * 100));
  });

  it('registra efectivo y transferencia como formas de pago', () => {
    expect(paymentFormsFor(500, 700, 1200)).toEqual([{ method: 1, amount: 500 }, { method: 2, amount: 700 }]);
    expect(paymentFormsFor(0, 0, 1200)).toEqual([{ method: 1, amount: 1200 }]);
  });
});

describe('reglas DGII', () => {
  const totals = (totalAmount: number) => ({ itbisRate: 18 as const, taxedAmount: 0, exemptAmount: 0, itbisAmount: 0, totalAmount });

  it('pide RNC y nombre para crédito fiscal', () => {
    expect(assertInvoiceRules('E31', null, totals(100))).toHaveLength(2);
    expect(assertInvoiceRules('E31', { rnc: '131123456', name: 'Empresa SRL' }, totals(100))).toEqual([]);
  });

  it('pide identificar al cliente desde RD$250,000 en consumo', () => {
    expect(assertInvoiceRules('E32', null, totals(249_999.99))).toEqual([]);
    expect(assertInvoiceRules('E32', null, totals(250_000))).toHaveLength(1);
  });
});

describe('notas de crédito', () => {
  const lines = buildLines([{ name: 'Perfume', quantity: 2, unitPrice: 590 }], 1180, 18);

  it('copia las líneas en una anulación total', () => {
    const result = creditNoteLines(lines, 1180, undefined, 18);
    expect(result.modificationCode).toBe(1);
    expect(result.lines).toEqual(lines);
  });

  it('usa una sola línea en una devolución parcial', () => {
    const result = creditNoteLines(lines, 1180, 590, 18);
    expect(result.modificationCode).toBe(3);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.amount).toBe(590);
  });

  it('no permite acreditar más que la factura', () => {
    expect(() => creditNoteLines(lines, 1180, 1200, 18)).toThrow();
  });
});

describe('fecha dominicana', () => {
  it('usa UTC-4 para la fecha de emisión', () => {
    expect(dominicanDate(new Date('2026-11-11T02:30:00.000Z'))).toBe('2026-11-10');
    expect(dominicanDate(new Date('2026-11-11T05:00:00.000Z'))).toBe('2026-11-11');
  });
});
