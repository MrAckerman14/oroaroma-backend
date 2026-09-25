import { z } from 'zod';

export const warehouseIdSchema = z.object({ id: z.uuid() });
export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/)
});
export const updateWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
}).refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un campo');
export const createInventoryTransferSchema = z.object({
  sourceWarehouseId: z.uuid(),
  destinationWarehouseId: z.uuid(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(1_000_000) })).min(1).max(500)
}).superRefine((value, context) => {
  if (value.sourceWarehouseId === value.destinationWarehouseId) {
    context.addIssue({ code: 'custom', path: ['destinationWarehouseId'], message: 'El almacén destino debe ser diferente al origen' });
  }
  const ids = value.items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'No se puede repetir un producto en la transferencia' });
  }
});
