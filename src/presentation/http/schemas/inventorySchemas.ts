import { z } from 'zod';

export const createInventoryReportSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  note: z.string().max(1000).nullable().optional()
});

export const updateInventoryReportSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  note: z.string().max(1000).nullable().optional()
}).refine((value) => value.name !== undefined || value.note !== undefined, {
  message: 'Debes enviar el nombre o la nota'
});
