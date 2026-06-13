import { z } from 'zod';
import { env } from '../../../config/env.js';

export const createCashClosureSchema = z.object({
  saleIds: z.array(z.uuid()).min(1).max(env.CASH_CLOSURE_MAX_SALES).optional()
});

export const closureStatusSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'VOIDED'])
});
