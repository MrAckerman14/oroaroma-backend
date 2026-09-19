import { z } from 'zod';
export const branchIdSchema = z.object({ id: z.uuid() });
export const branchInventorySharingSchema = z.object({
  mode: z.enum(['INDEPENDENT', 'FULL', 'SELECTIVE']),
  sourceBranchId: z.uuid().optional(),
  productIds: z.array(z.uuid()).max(1000).optional()
});
export const createBranchSchema = z.object({ name: z.string().trim().min(2).max(100), code: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/), address: z.string().trim().max(250).optional(), phone: z.string().trim().max(30).optional() });
export const updateBranchSchema = createBranchSchema.partial().refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un campo');
export const branchStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
export const branchMembersSchema = z.object({ userIds: z.array(z.uuid()).max(500), primaryUserIds: z.array(z.uuid()).max(500).default([]) });
