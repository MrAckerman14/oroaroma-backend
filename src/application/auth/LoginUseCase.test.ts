import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from './LoginUseCase.js';
import type { PrismaUserRepository } from '../../infrastructure/repositories/PrismaUserRepository.js';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

describe('LoginUseCase.refresh', () => {
  it('rota el refresh token y revoca atomicamente el anterior', async () => {
    const authenticatedUser: AuthenticatedUser = {
      id: 'user-1',
      tenantId: 'default',
      email: 'user@test.local',
      name: 'Usuario Test',
      status: 'ACTIVE',
      statusLabel: 'Activo',
      roles: [],
      permissions: []
    };
    const rawUser = {
      id: authenticatedUser.id,
      deletedAt: null,
      status: 'ACTIVE',
      tenant: { status: 'ACTIVE' }
    };
    const prisma = {
      $queryRaw: vi.fn(async () => [{ tenantId: 'default' }]),
      refreshSession: {
        findUnique: vi.fn(async () => ({
          id: 'refresh-session-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          user: rawUser
        }))
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        refreshSession: {
          updateMany: vi.fn(async () => ({ count: 1 })),
          create: vi.fn(async () => ({}))
        }
      }))
    };
    const app = {
      jwt: {
        sign: vi.fn(() => 'next-access-token')
      }
    };
    const users = {
      toAuthenticatedUser: vi.fn(() => authenticatedUser)
    };
    const login = new LoginUseCase(
      app as unknown as FastifyInstance,
      prisma as unknown as PrismaClient,
      users as unknown as PrismaUserRepository,
      {} as PasswordHasher
    );

    const firstRefresh = await login.refresh('current-refresh-token');
    expect(firstRefresh).toMatchObject({
      accessToken: 'next-access-token',
      user: authenticatedUser
    });
    expect(firstRefresh.refreshToken).toEqual(expect.any(String));
    expect(firstRefresh.refreshToken).not.toBe('current-refresh-token');
    expect(prisma.refreshSession.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
