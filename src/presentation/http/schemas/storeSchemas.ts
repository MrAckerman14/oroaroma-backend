import { z } from 'zod';
import { dateRangePaginationQuerySchema } from './commonSchemas.js';

export const createStoreSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional(),
  purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  stock: z.number().int().min(0),
  imagePath: z.string().optional()
});

export const updateStoreSchema = createStoreSchema.partial();

export const storeListQuerySchema = dateRangePaginationQuerySchema.extend({
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().min(0).optional()
}).refine((value) => {
  return value.minStock === undefined || value.maxStock === undefined || value.minStock <= value.maxStock;
}, {
  path: ['maxStock'],
  message: 'El stock maximo debe ser mayor o igual al stock minimo'
});
