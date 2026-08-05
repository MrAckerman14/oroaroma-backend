import { z } from 'zod';

const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const createLocationSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}, z.string().max(1000).optional());
const updateLocationSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}, z.string().max(1000).nullable().optional());

const saleItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive()
});

export const createSaleSchema = z.object({
  employeeId: z.uuid().optional(),
  messengerId: z.uuid().optional(),
  sellerId: z.uuid().optional(),
  amount: moneySchema,
  amountCash: moneySchema.default('0'),
  amountTransfer: moneySchema.default('0'),
  deliveryPay: moneySchema.default('0'),
  phone: z.string().min(6).max(30).optional(),
  description: z.string().max(500).optional(),
  locationUrl: createLocationSchema,
  items: z.array(saleItemSchema).min(1)
});

export const updateSaleSchema = z.object({
  employeeId: z.uuid().optional(),
  messengerId: z.uuid().nullable().optional(),
  sellerId: z.uuid().nullable().optional(),
  amount: moneySchema.optional(),
  amountCash: moneySchema.optional(),
  amountTransfer: moneySchema.optional(),
  deliveryPay: moneySchema.optional(),
  phone: z.string().min(6).max(30).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  locationUrl: updateLocationSchema,
  status: z.enum(['DELIVERY_PENDING', 'FINALIZED', 'CANCELLED']).optional(),
  items: z.array(saleItemSchema).min(1).optional()
});
