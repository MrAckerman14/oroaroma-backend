import type { AuthenticatedUser } from './rbac.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  type: 'access';
  tenantId?: string;
}

export interface LoginInput {
  tenant?: string;
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
