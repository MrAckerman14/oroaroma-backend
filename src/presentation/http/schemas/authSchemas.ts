import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().min(6).max(30).optional(),
  profileImagePath: z.string().optional()
});

export const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.email().optional(),
  phone: z.string().min(6).max(30).nullable().optional(),
  profileImagePath: z.string().nullable().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32)
});
