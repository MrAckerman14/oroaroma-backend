import { z } from 'zod';

const amountSchema = z.coerce.number().finite().positive().max(999999999999.99);
const dateSchema = z.string().date();
const descriptionSchema = z.string().trim().max(500).optional();

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const createExpenseControlSchema = z.object({
  amount: amountSchema,
  type: z.enum(['EXPENSE', 'INCOME']),
  categoryId: z.uuid().optional(),
  categoryName: z.string().trim().min(2).max(80).optional(),
  date: dateSchema,
  description: descriptionSchema
}).refine((value) => Boolean(value.categoryId) !== Boolean(value.categoryName), {
  message: 'Use categoryId o categoryName, pero no ambos',
  path: ['categoryId']
});

export const updateExpenseControlSchema = createExpenseControlSchema.partial().refine(
  (value) => !(value.categoryId && value.categoryName),
  { message: 'Use categoryId o categoryName, pero no ambos', path: ['categoryId'] }
).refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un campo');

export const createExpenseReportSchema = z.object({
  name: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional()
});

export const updateExpenseReportSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().max(1000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un campo');
