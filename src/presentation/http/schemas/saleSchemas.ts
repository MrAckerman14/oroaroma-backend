import { z } from 'zod';

const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

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
  status: z.enum(['DELIVERY_PENDING', 'FINALIZED', 'CANCELLED']).optional(),
  items: z.array(saleItemSchema).min(1).optional()
});
