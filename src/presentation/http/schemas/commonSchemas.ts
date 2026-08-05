import { z } from 'zod';
import { env } from '../../../config/env.js';

export const idParamsSchema = z.object({
  id: z.uuid()
});

export const dateRangeQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional()
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(env.DEFAULT_PAGE_SIZE)
});

export const dateRangePaginationQuerySchema = dateRangeQuerySchema.merge(paginationQuerySchema);

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginationArgs(input: PaginationQuery) {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize
  };
}

export function paginationMeta(input: PaginationQuery, total: number) {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.ceil(total / input.pageSize)
  };
}
