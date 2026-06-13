import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional(),
  purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  stock: z.number().int().min(0),
  imagePath: z.string().optional()
});

export const updateStoreSchema = createStoreSchema.partial();
