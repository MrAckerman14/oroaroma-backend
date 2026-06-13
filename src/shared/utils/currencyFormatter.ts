import { currencyFormatConfig } from '../../config/env.js';

export interface CurrencyFormatConfig {
  currency: string;
  country: string;
  symbol: string;
  groupSeparator: string;
  decimalSeparator: string;
  minorUnitDigits: number;
  trimZeroMinorUnits: boolean;
  symbolSpacing: boolean;
}

const currencyFieldNames = new Set([
  'amount',
  'amountToPay',
  'amountCash',
  'amountTransfer',
  'average',
  'bonus',
  'bonusAmount',
  'cash',
  'deliveryPay',
  'deliveryPayment',
  'gross',
  'grossTotal',
  'generalSale',
  'generalSales',
  'internalSale',
  'internalSales',
  'inventoryValue',
  'messengerCost',
  'net',
  'netCash',
  'netTotal',
  'pendingCash',
  'pendingDeliveryPay',
  'pendingMoney',
  'pendingAmount',
  'pendingMessengerCost',
  'pendingMessengerPay',
  'pendingPayment',
  'pendingPayments',
  'pendingSalesMoney',
  'perfumeCost',
  'perfumeIncome',
  'perfumeMoney',
  'price',
  'productIncome',
  'purchasePrice',
  'salePrice',
  'sellerTotal',
  'sellerNet',
  'shippingCost',
  'shippingMoney',
  'shippingPayment',
  'subtotal',
  'total',
  'totalSold',
  'totalCash',
  'totalInventoryValue',
  'totalMessengerCost',
  'totalSale',
  'totalSales',
  'totalTransfer',
  'transfer',
  'unitPrice',
  'value'
]);

export function formatCurrency(value: unknown, config: CurrencyFormatConfig = currencyFormatConfig): string | undefined {
  const normalized = normalizeDecimal(value, config);
  if (!normalized) return undefined;

  const rounded = roundDecimal(normalized.integer, normalized.fraction, config.minorUnitDigits);
  const groupedInteger = groupInteger(rounded.integer, config.groupSeparator);
  const isZero = rounded.integer === '0' && /^0+$/.test(rounded.fraction);
  const fraction = config.trimZeroMinorUnits && !isZero && /^0+$/.test(rounded.fraction)
    ? ''
    : `${config.decimalSeparator}${rounded.fraction}`;
  const sign = normalized.negative && (rounded.integer !== '0' || !/^0+$/.test(rounded.fraction)) ? '-' : '';
  const space = config.symbolSpacing ? ' ' : '';

  return `${sign}${config.symbol}${space}${groupedInteger}${fraction}`;
}

export function addFormattedCurrencyFields<T>(payload: T, config: CurrencyFormatConfig = currencyFormatConfig): T {
  return formatCurrencyFields(payload, config) as T;
}

function formatCurrencyFields(value: unknown, config: CurrencyFormatConfig): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => formatCurrencyFields(item, config));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    next[key] = formatCurrencyFields(entryValue, config);

    if (currencyFieldNames.has(key) && !key.endsWith('Formatted')) {
      const formatted = formatCurrency(entryValue, config);
      if (formatted) {
        next[`${key}Formatted`] = formatted;
      }
    }
  }

  return next;
}

function normalizeDecimal(value: unknown, config: CurrencyFormatConfig) {
  const raw = decimalValueToString(value);
  if (!raw) return undefined;

  const withoutGroups = raw.split(config.groupSeparator).join('');
  const normalized = config.decimalSeparator === '.'
    ? withoutGroups
    : withoutGroups.replace(config.decimalSeparator, '.');
  const match = normalized.match(/^([+-])?(\d+)(?:\.(\d+))?$/);
  if (!match) return undefined;

  return {
    negative: match[1] === '-',
    integer: stripLeadingZeroes(match[2] ?? '0'),
    fraction: match[3] ?? ''
  };
}

function decimalValueToString(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === 'bigint') return value.toString();
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as { toString?: unknown };
  if (typeof candidate.toString !== 'function' || candidate.toString === Object.prototype.toString) {
    return undefined;
  }

  const raw: unknown = candidate.toString.call(value);
  return typeof raw === 'string' ? raw.trim() : undefined;
}

function roundDecimal(integer: string, fraction: string, digits: number) {
  if (digits === 0) {
    const nextDigit = Number(fraction[0] ?? '0');
    return {
      integer: nextDigit >= 5 ? (BigInt(integer) + 1n).toString() : integer,
      fraction: ''
    };
  }

  const padded = fraction.padEnd(digits + 1, '0');
  const keptFraction = padded.slice(0, digits);
  const nextDigit = Number(padded[digits] ?? '0');
  const scale = 10n ** BigInt(digits);
  const units = BigInt(integer) * scale + BigInt(keptFraction || '0') + (nextDigit >= 5 ? 1n : 0n);

  return {
    integer: (units / scale).toString(),
    fraction: (units % scale).toString().padStart(digits, '0')
  };
}

function groupInteger(integer: string, separator: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function stripLeadingZeroes(value: string) {
  return value.replace(/^0+(?=\d)/, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
