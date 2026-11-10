// Reglas de los comprobantes fiscales electrónicos (e-CF) de la DGII, sin depender
// del proveedor. El proveedor solo traduce este borrador a su API.

export type FiscalDocumentType = 'E31' | 'E32' | 'E33' | 'E34';
export type FiscalStatus = 'PENDING' | 'IN_PROCESS' | 'ACCEPTED' | 'ACCEPTED_WITH_OBSERVATIONS' | 'REJECTED' | 'FAILED';
export type ItbisRate = 0 | 16 | 18;

export const fiscalDocumentLabels: Record<FiscalDocumentType, string> = {
  E31: 'Factura de crédito fiscal',
  E32: 'Factura de consumo',
  E33: 'Nota de débito',
  E34: 'Nota de crédito'
};

/** Desde este total una factura de consumo debe identificar al comprador y espera respuesta de la DGII. */
export const CONSUMER_INVOICE_IDENTIFIED_THRESHOLD = 250_000;
const ENCF_NUMBER_DIGITS = 10;
const ITEM_NAME_MAX = 80;

export interface FiscalIssuer {
  rnc: string;
  legalName: string;
  tradeName?: string | null;
  address: string;
  municipality?: string | null;
  province?: string | null;
  email?: string | null;
  phone?: string | null;
  economicActivity?: string | null;
  branchName?: string | null;
}

export interface FiscalBuyer {
  rnc?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface FiscalLine {
  lineNumber: number;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
  /** 1 = ITBIS 18 %, 2 = ITBIS 16 %, 3 = ITBIS 0 %, 4 = exento */
  billingIndicator: 1 | 2 | 3 | 4;
  /** 1 = bien, 2 = servicio */
  kind: 1 | 2;
}

export interface FiscalTotals {
  itbisRate: ItbisRate;
  taxedAmount: number;
  exemptAmount: number;
  itbisAmount: number;
  totalAmount: number;
}

export interface FiscalReference {
  encf: string;
  stampDate: string;
  /** 1 = anulación total, 3 = corrige montos */
  modificationCode: 1 | 3;
  reason: string;
  /** 1 cuando la nota se emite más de 30 días después del comprobante afectado */
  creditNoteIndicator: 0 | 1;
}

export interface FiscalDraft {
  documentType: FiscalDocumentType;
  encf: string;
  sequenceExpiresAt: string;
  stampDate: string;
  internalNumber: string;
  issuer: FiscalIssuer;
  buyer: FiscalBuyer | null;
  taxIncluded: boolean;
  paymentForms: Array<{ method: 1 | 2 | 3; amount: number }>;
  lines: FiscalLine[];
  totals: FiscalTotals;
  reference?: FiscalReference;
}

export interface SaleLineInput {
  name: string;
  quantity: number;
  unitPrice: number;
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function cents(value: number) {
  return Math.round(value * 100);
}

export function formatEncf(documentType: FiscalDocumentType, sequenceNumber: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 9_999_999_999) {
    throw new Error('Número de secuencia fuera de rango');
  }
  return `${documentType}${String(sequenceNumber).padStart(ENCF_NUMBER_DIGITS, '0')}`;
}

export function isValidEncf(value: string) {
  return /^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/.test(value);
}

/** RNC (9 dígitos) o cédula (11 dígitos). Se aceptan guiones y espacios al escribir. */
export function normalizeTaxId(value: string | null | undefined) {
  const digits = (value ?? '').replace(/[\s-]/g, '');
  return digits || null;
}

export function isValidTaxId(value: string | null | undefined) {
  const digits = normalizeTaxId(value);
  return Boolean(digits && /^(\d{9}|\d{11})$/.test(digits));
}

/** Factura de crédito fiscal si el comprador da su RNC/cédula; si no, factura de consumo. */
export function resolveInvoiceType(buyer: FiscalBuyer | null, requested?: 'E31' | 'E32'): 'E31' | 'E32' {
  if (requested) return requested;
  return buyer?.rnc ? 'E31' : 'E32';
}

export function billingIndicatorFor(rate: ItbisRate): 1 | 2 | 3 {
  if (rate === 18) return 1;
  if (rate === 16) return 2;
  return 3;
}

/**
 * Convierte los productos de una venta en líneas fiscales cuyo total coincide con
 * lo cobrado. Si se cobró menos que la suma de precios, la diferencia se reparte
 * como descuento; si se cobró más, se agrega una línea de servicio (envío/cargos).
 */
export function buildLines(items: SaleLineInput[], chargedTotal: number, rate: ItbisRate): FiscalLine[] {
  if (items.length === 0) throw new Error('La venta no tiene productos');
  const indicator = billingIndicatorFor(rate);
  const gross = items.map((item) => cents(item.quantity * item.unitPrice));
  const grossTotal = gross.reduce((sum, value) => sum + value, 0);
  const charged = cents(chargedTotal);
  const discounts = new Array<number>(items.length).fill(0);

  if (charged < grossTotal) {
    const discountTotal = grossTotal - charged;
    let assigned = 0;
    items.forEach((_, index) => {
      if (index === items.length - 1) {
        discounts[index] = discountTotal - assigned;
      } else {
        const share = grossTotal === 0 ? 0 : Math.floor((discountTotal * gross[index]!) / grossTotal);
        discounts[index] = share;
        assigned += share;
      }
    });
  }

  const lines: FiscalLine[] = items.map((item, index) => ({
    lineNumber: index + 1,
    name: truncate(item.name, ITEM_NAME_MAX),
    quantity: item.quantity,
    unitPrice: round2(item.unitPrice),
    discount: discounts[index]! / 100,
    amount: (gross[index]! - discounts[index]!) / 100,
    billingIndicator: indicator,
    kind: 1
  }));

  if (charged > grossTotal) {
    const extra = (charged - grossTotal) / 100;
    lines.push({
      lineNumber: lines.length + 1,
      name: 'Envío y otros cargos',
      quantity: 1,
      unitPrice: extra,
      discount: 0,
      amount: extra,
      billingIndicator: indicator,
      kind: 2
    });
  }

  return lines;
}

/** Totales a partir de las líneas. Con impuesto incluido, el ITBIS se extrae del total cobrado. */
export function computeTotals(lines: FiscalLine[], rate: ItbisRate, taxIncluded: boolean): FiscalTotals {
  const linesTotal = lines.reduce((sum, line) => sum + cents(line.amount), 0);
  if (rate === 0) {
    const total = linesTotal / 100;
    return { itbisRate: 0, taxedAmount: total, exemptAmount: 0, itbisAmount: 0, totalAmount: total };
  }
  if (taxIncluded) {
    const taxed = Math.round(linesTotal / (1 + rate / 100));
    return {
      itbisRate: rate,
      taxedAmount: taxed / 100,
      exemptAmount: 0,
      itbisAmount: (linesTotal - taxed) / 100,
      totalAmount: linesTotal / 100
    };
  }
  const itbis = Math.round((linesTotal * rate) / 100);
  return {
    itbisRate: rate,
    taxedAmount: linesTotal / 100,
    exemptAmount: 0,
    itbisAmount: itbis / 100,
    totalAmount: (linesTotal + itbis) / 100
  };
}

export function paymentFormsFor(cash: number, transfer: number, total: number): FiscalDraft['paymentForms'] {
  const forms: FiscalDraft['paymentForms'] = [];
  if (cash > 0) forms.push({ method: 1, amount: round2(cash) });
  if (transfer > 0) forms.push({ method: 2, amount: round2(transfer) });
  if (forms.length === 0) forms.push({ method: 1, amount: round2(total) });
  return forms;
}

/** Reglas que la DGII rechazaría; se validan antes de gastar un número de secuencia. */
export function assertInvoiceRules(documentType: FiscalDocumentType, buyer: FiscalBuyer | null, totals: FiscalTotals) {
  const errors: string[] = [];
  if (buyer?.rnc && !isValidTaxId(buyer.rnc)) errors.push('El RNC o cédula del cliente debe tener 9 u 11 dígitos');
  if (documentType === 'E31') {
    if (!buyer?.rnc) errors.push('La factura de crédito fiscal necesita el RNC o cédula del cliente');
    if (!buyer?.name?.trim()) errors.push('La factura de crédito fiscal necesita el nombre o razón social del cliente');
  }
  if (documentType === 'E32' && totals.totalAmount >= CONSUMER_INVOICE_IDENTIFIED_THRESHOLD && !buyer?.rnc) {
    errors.push('Desde RD$250,000 la factura de consumo necesita el RNC o cédula del cliente');
  }
  if (totals.totalAmount <= 0) errors.push('El total de la factura debe ser mayor que cero');
  return errors;
}

/** Líneas de una nota de crédito: total = copia exacta; parcial = una sola línea por el monto. */
export function creditNoteLines(original: FiscalLine[], originalTotal: number, amount: number | undefined, rate: ItbisRate) {
  if (amount === undefined || cents(amount) === cents(originalTotal)) {
    return { lines: original.map((line) => ({ ...line })), modificationCode: 1 as const };
  }
  if (amount <= 0 || cents(amount) > cents(originalTotal)) {
    throw new Error('El monto de la nota de crédito debe ser mayor que cero y no superar el de la factura');
  }
  const value = round2(amount);
  return {
    lines: [{
      lineNumber: 1,
      name: 'Devolución parcial',
      quantity: 1,
      unitPrice: value,
      discount: 0,
      amount: value,
      billingIndicator: billingIndicatorFor(rate),
      kind: 1 as const
    }],
    modificationCode: 3 as const
  };
}

export function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Fecha calendario en República Dominicana (UTC-4, sin horario de verano). */
export function dominicanDate(date: Date) {
  return new Date(date.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
}

function truncate(value: string, max: number) {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean.length > max ? clean.slice(0, max) : clean;
}
