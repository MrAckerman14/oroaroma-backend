import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.email(),
  adminPassword: z.string().min(10).max(128)
});

export const tenantIdSchema = z.object({ id: z.string().uuid() });
export const tenantStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']) });
