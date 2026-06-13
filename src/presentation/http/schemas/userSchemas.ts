import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().min(6).max(30).optional(),
  profileImagePath: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).default('ACTIVE'),
  roleKey: z.string().min(2).optional(),
  scope: z.enum(['GLOBAL', 'STORE', 'OWN', 'ASSIGNED']).default('GLOBAL'),
  storeId: z.uuid().optional()
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  phone: z.string().min(6).max(30).nullable().optional(),
  profileImagePath: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  roleKey: z.string().min(2).optional(),
  scope: z.enum(['GLOBAL', 'STORE', 'OWN', 'ASSIGNED']).optional(),
  storeId: z.uuid().optional()
});

export const assignRoleSchema = z.object({
  roleKey: z.string().min(2),
  scope: z.enum(['GLOBAL', 'STORE', 'OWN', 'ASSIGNED']).default('GLOBAL'),
  storeId: z.uuid().optional(),
  expiresAt: z.string().datetime().optional()
});
