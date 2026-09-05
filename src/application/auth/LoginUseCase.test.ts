import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from './LoginUseCase.js';
import type { PrismaUserRepository } from '../../infrastructure/repositories/PrismaUserRepository.js';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

describe('LoginUseCase.refresh', () => {
  it('mantiene el refresh token vigente para evitar cerrar sesion por refresh concurrente', async () => {
    const authenticatedUser: AuthenticatedUser = {
      id: 'user-1',
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
      status: 'ACTIVE'
    };
    const prisma = {
      refreshSession: {
        findUnique: vi.fn(async () => ({
          id: 'refresh-session-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          user: rawUser
        }))
      },
      $transaction: vi.fn()
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
    const secondRefresh = await login.refresh('current-refresh-token');

    expect(firstRefresh).toMatchObject({
      accessToken: 'next-access-token',
      refreshToken: 'current-refresh-token',
      user: authenticatedUser
    });
    expect(secondRefresh.refreshToken).toBe('current-refresh-token');
    expect(prisma.refreshSession.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
