import { describe, expect, it } from 'vitest';
import type { AuthSession } from '../../../types/auth.js';
import { publicSession, refreshCookieOptions } from './authRoutes.js';

describe('auth session transport', () => {
  const session = {
    accessToken: 'access-token',
    refreshToken: 'sensitive-refresh-token',
    user: {
      id: 'user-1', tenantId: 'tenant-1', email: 'one@test.local', name: 'One',
      status: 'ACTIVE', statusLabel: 'Activo', roles: [], permissions: []
    }
  } satisfies AuthSession;

  it('no expone el refresh token en el cuerpo', () => {
    expect(publicSession(session)).not.toHaveProperty('refreshToken');
    expect(publicSession(session)).toHaveProperty('accessToken', 'access-token');
  });

  it('configura el refresh token como cookie HttpOnly', () => {
    expect(refreshCookieOptions()).toMatchObject({
      path: '/auth',
      httpOnly: true,
      sameSite: 'strict'
    });
  });
});
