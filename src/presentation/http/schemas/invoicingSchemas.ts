import { z } from 'zod';
import { dateRangePaginationQuerySchema } from './commonSchemas.js';

const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullable().optional();
const territoryCode = z.string().regex(/^\d{6}$/, 'Usa el código de 6 dígitos de la DGII').nullable().optional();

export const fiscalProfileSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['SIMULATED', 'ALANUBE']).optional(),
  environment: z.enum(['TEST', 'PRODUCTION']).optional(),
  rnc: text(13).optional(),
  legalName: text(150).min(2).optional(),
  tradeName: nullableText(150),
  address: text(100).min(3).optional(),
  municipality: territoryCode,
  province: territoryCode,
  email: z.email().max(80).nullable().optional(),
  phone: nullableText(12),
  economicActivity: nullableText(100),
  providerCompanyId: nullableText(64),
  providerToken: z.string().trim().max(4000).nullable().optional(),
  pricesIncludeTax: z.boolean().optional(),
  itbisRate: z.union([z.literal(0), z.literal(16), z.literal(18)]).optional(),
  autoIssueOnFinalize: z.boolean().optional()
}).strict();

export const fiscalSequenceSchema = z.object({
  documentType: z.enum(['E31', 'E32', 'E33', 'E34']),
  startNumber: z.number().int().min(1).max(9_999_999_999),
  endNumber: z.number().int().min(1).max(9_999_999_999),
  expiresAt: z.string().date()
}).strict();

export const fiscalSequenceUpdateSchema = z.object({ active: z.boolean() }).strict();

export const issueInvoiceSchema = z.object({
  documentType: z.enum(['E31', 'E32']).optional(),
  buyer: z.object({
    rnc: text(13).optional(),
    name: text(150).optional(),
    email: z.email().max(80).optional()
  }).strict().optional()
}).strict();

export const creditNoteSchema = z.object({
  reason: text(90).min(3),
  amount: z.number().positive().max(9_999_999_999).optional()
}).strict();

export const fiscalDocumentListQuerySchema = dateRangePaginationQuerySchema.extend({
  status: z.enum(['PENDING', 'IN_PROCESS', 'ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED', 'FAILED']).optional(),
  documentType: z.enum(['E31', 'E32', 'E33', 'E34']).optional(),
  saleId: z.uuid().optional()
});
